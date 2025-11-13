#!/usr/bin/env node
/**
 * Retention Audit Script
 * 
 * 僅讀稽核腳本：檢查過期文件數量，不實際刪除
 * 
 * 使用方法：
 *   node scripts/retention/audit.mjs
 */

import { createClient } from '@supabase/supabase-js';

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 清理規則
const RETENTION_RULES = {
  originals: 72 * 60 * 60 * 1000, // 72 小時（毫秒）
  previews: 7 * 24 * 60 * 60 * 1000, // 7 天（毫秒）
  analytics_logs: 180 * 24 * 60 * 60 * 1000, // 180 天（毫秒）
};

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 創建 Supabase Client（使用 Service Role）
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 稽核結果
const auditResults = {
  originals: { total: 0, expired: 0 },
  previews: { total: 0, expired: 0 },
  analytics_logs: { total: 0, expired: 0 },
};

/**
 * 稽核 originals bucket
 */
async function auditOriginals() {
  log('\n📤 稽核 originals bucket（72 小時）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.originals);
    
    // 查詢所有文件
    const { data: files, error } = await supabase.storage
      .from('originals')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (error) {
      throw error;
    }

    auditResults.originals.total = files.length;
    
    // 過濾過期文件
    const expiredFiles = files.filter(file => {
      const fileTime = new Date(file.created_at);
      return fileTime < cutoffTime;
    });

    auditResults.originals.expired = expiredFiles.length;
    
    log(`總數: ${files.length}, 過期: ${expiredFiles.length}`, 'green');
  } catch (error) {
    log(`❌ 稽核 originals 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 稽核 previews bucket
 */
async function auditPreviews() {
  log('\n📤 稽核 previews bucket（7 天）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.previews);
    
    // 查詢所有文件
    const { data: files, error } = await supabase.storage
      .from('previews')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (error) {
      throw error;
    }

    auditResults.previews.total = files.length;
    
    // 過濾過期文件
    const expiredFiles = files.filter(file => {
      const fileTime = new Date(file.created_at);
      return fileTime < cutoffTime;
    });

    auditResults.previews.expired = expiredFiles.length;
    
    log(`總數: ${files.length}, 過期: ${expiredFiles.length}`, 'green');
  } catch (error) {
    log(`❌ 稽核 previews 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 稽核 analytics_logs
 */
async function auditAnalyticsLogs() {
  log('\n📊 稽核 analytics_logs（180 天）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.analytics_logs);
    
    // 查詢總數
    const { count: total, error: countError } = await supabase
      .from('analytics_logs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    // 查詢過期記錄數
    const { count: expired, error: expiredError } = await supabase
      .from('analytics_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffTime.toISOString());

    if (expiredError) {
      throw expiredError;
    }

    auditResults.analytics_logs.total = total || 0;
    auditResults.analytics_logs.expired = expired || 0;
    
    log(`總數: ${total || 0}, 過期: ${expired || 0}`, 'green');
  } catch (error) {
    log(`❌ 稽核 analytics_logs 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  log('🔍 開始 Retention 稽核', 'blue');
  log('='.repeat(50), 'blue');
  
  try {
    // 稽核 originals
    await auditOriginals();
    
    // 稽核 previews
    await auditPreviews();
    
    // 稽核 analytics_logs
    await auditAnalyticsLogs();
    
    // 輸出摘要
    log('\n' + '='.repeat(50), 'blue');
    log('📋 稽核結果摘要', 'blue');
    log('='.repeat(50), 'blue');
    log(`originals: ${auditResults.originals.expired}/${auditResults.originals.total} 過期`, 'green');
    log(`previews: ${auditResults.previews.expired}/${auditResults.previews.total} 過期`, 'green');
    log(`analytics_logs: ${auditResults.analytics_logs.expired}/${auditResults.analytics_logs.total} 過期`, 'green');
    
    process.exit(0);
  } catch (error) {
    log(`\n❌ 稽核執行失敗: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 執行主函數
main();




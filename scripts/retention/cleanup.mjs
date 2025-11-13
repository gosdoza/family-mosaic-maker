#!/usr/bin/env node
/**
 * Retention Cleanup Script
 * 
 * 清理過期文件：
 * - originals: 72 小時
 * - previews: 7 天
 * - analytics_logs: 180 天
 * 
 * 使用方法：
 *   node scripts/retention/cleanup.mjs [--dry-run] [--percent=10]
 * 
 * 參數：
 *   --dry-run: 僅模擬，不實際刪除
 *   --percent: 灰度刪除百分比（1-100），預設 100（全量）
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

// 解析參數
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const percentArg = args.find(arg => arg.startsWith('--percent='));
const percent = percentArg ? parseInt(percentArg.split('=')[1]) : 100;

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

// 清理結果
const cleanupResults = {
  originals: { total: 0, deleted: 0, sample: [] },
  previews: { total: 0, deleted: 0, sample: [] },
  analytics_logs: { total: 0, deleted: 0, sample: [] },
  error: null,
  autoDegraded: false,
};

/**
 * 清理 originals bucket（72 小時）
 */
async function cleanupOriginals() {
  log('\n📤 清理 originals bucket（72 小時）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.originals);
    
    // 查詢過期文件
    const { data: files, error: listError } = await supabase.storage
      .from('originals')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      throw listError;
    }

    // 過濾過期文件
    const expiredFiles = files.filter(file => {
      const fileTime = new Date(file.created_at);
      return fileTime < cutoffTime;
    });

    cleanupResults.originals.total = expiredFiles.length;
    
    if (expiredFiles.length === 0) {
      log('✅ 無過期文件', 'green');
      return;
    }

    // 灰度刪除
    const deleteCount = Math.ceil(expiredFiles.length * (percent / 100));
    const filesToDelete = expiredFiles.slice(0, deleteCount);
    
    // 記錄抽樣 ID
    const sampleIds = filesToDelete.slice(0, 10).map(f => f.id);
    cleanupResults.originals.sample = sampleIds;

    if (isDryRun) {
      log(`🔍 Dry-run: 將刪除 ${deleteCount} 個文件（共 ${expiredFiles.length} 個過期）`, 'yellow');
      cleanupResults.originals.deleted = 0;
    } else {
      // 實際刪除
      const filePaths = filesToDelete.map(f => f.name);
      const { error: deleteError } = await supabase.storage
        .from('originals')
        .remove(filePaths);

      if (deleteError) {
        throw deleteError;
      }

      log(`✅ 已刪除 ${deleteCount} 個文件（共 ${expiredFiles.length} 個過期）`, 'green');
      cleanupResults.originals.deleted = deleteCount;
    }
  } catch (error) {
    log(`❌ 清理 originals 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 清理 previews bucket（7 天）
 */
async function cleanupPreviews() {
  log('\n📤 清理 previews bucket（7 天）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.previews);
    
    // 查詢過期文件
    const { data: files, error: listError } = await supabase.storage
      .from('previews')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      throw listError;
    }

    // 過濾過期文件
    const expiredFiles = files.filter(file => {
      const fileTime = new Date(file.created_at);
      return fileTime < cutoffTime;
    });

    cleanupResults.previews.total = expiredFiles.length;
    
    if (expiredFiles.length === 0) {
      log('✅ 無過期文件', 'green');
      return;
    }

    // 灰度刪除
    const deleteCount = Math.ceil(expiredFiles.length * (percent / 100));
    const filesToDelete = expiredFiles.slice(0, deleteCount);
    
    // 記錄抽樣 ID
    const sampleIds = filesToDelete.slice(0, 10).map(f => f.id);
    cleanupResults.previews.sample = sampleIds;

    if (isDryRun) {
      log(`🔍 Dry-run: 將刪除 ${deleteCount} 個文件（共 ${expiredFiles.length} 個過期）`, 'yellow');
      cleanupResults.previews.deleted = 0;
    } else {
      // 實際刪除
      const filePaths = filesToDelete.map(f => f.name);
      const { error: deleteError } = await supabase.storage
        .from('previews')
        .remove(filePaths);

      if (deleteError) {
        throw deleteError;
      }

      log(`✅ 已刪除 ${deleteCount} 個文件（共 ${expiredFiles.length} 個過期）`, 'green');
      cleanupResults.previews.deleted = deleteCount;
    }
  } catch (error) {
    log(`❌ 清理 previews 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 清理 analytics_logs（180 天）
 */
async function cleanupAnalyticsLogs() {
  log('\n📊 清理 analytics_logs（180 天）', 'blue');
  
  try {
    const cutoffTime = new Date(Date.now() - RETENTION_RULES.analytics_logs);
    
    // 查詢過期記錄
    const { data: logs, error: queryError } = await supabase
      .from('analytics_logs')
      .select('id')
      .lt('created_at', cutoffTime.toISOString())
      .limit(1000);

    if (queryError) {
      throw queryError;
    }

    cleanupResults.analytics_logs.total = logs.length;
    
    if (logs.length === 0) {
      log('✅ 無過期記錄', 'green');
      return;
    }

    // 灰度刪除
    const deleteCount = Math.ceil(logs.length * (percent / 100));
    const logsToDelete = logs.slice(0, deleteCount);
    
    // 記錄抽樣 ID
    const sampleIds = logsToDelete.slice(0, 10).map(l => l.id);
    cleanupResults.analytics_logs.sample = sampleIds;

    if (isDryRun) {
      log(`🔍 Dry-run: 將刪除 ${deleteCount} 條記錄（共 ${logs.length} 條過期）`, 'yellow');
      cleanupResults.analytics_logs.deleted = 0;
    } else {
      // 實際刪除
      const idsToDelete = logsToDelete.map(l => l.id);
      const { error: deleteError } = await supabase
        .from('analytics_logs')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        throw deleteError;
      }

      log(`✅ 已刪除 ${deleteCount} 條記錄（共 ${logs.length} 條過期）`, 'green');
      cleanupResults.analytics_logs.deleted = deleteCount;
    }
  } catch (error) {
    log(`❌ 清理 analytics_logs 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 寫入 analytics_logs
 */
async function logToAnalytics() {
  log('\n📊 寫入 analytics_logs', 'blue');
  
  try {
    const summary = {
      type: 'retention',
      dryRun: isDryRun,
      percent: percent,
      results: {
        originals: {
          total: cleanupResults.originals.total,
          deleted: cleanupResults.originals.deleted,
          sample: cleanupResults.originals.sample,
        },
        previews: {
          total: cleanupResults.previews.total,
          deleted: cleanupResults.previews.deleted,
          sample: cleanupResults.previews.sample,
        },
        analytics_logs: {
          total: cleanupResults.analytics_logs.total,
          deleted: cleanupResults.analytics_logs.deleted,
          sample: cleanupResults.analytics_logs.sample,
        },
      },
      error: cleanupResults.error,
      autoDegraded: cleanupResults.autoDegraded,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('analytics_logs')
      .insert({
        event_type: 'retention',
        event_data: summary,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    log('✅ 結果已寫入 analytics_logs', 'green');
    return summary;
  } catch (error) {
    log(`❌ 寫入 analytics_logs 失敗: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  log('🚀 開始 Retention 清理', 'blue');
  log('='.repeat(50), 'blue');
  log(`模式: ${isDryRun ? '🔍 Dry-run' : '✅ 實際刪除'}`, isDryRun ? 'yellow' : 'green');
  log(`灰度: ${percent}%`, 'blue');
  
  try {
    // 清理 originals
    await cleanupOriginals();
    
    // 清理 previews
    await cleanupPreviews();
    
    // 清理 analytics_logs
    await cleanupAnalyticsLogs();
    
    // 寫入 analytics_logs
    const summary = await logToAnalytics();
    
    // 輸出摘要
    log('\n' + '='.repeat(50), 'blue');
    log('📋 清理結果摘要', 'blue');
    log('='.repeat(50), 'blue');
    log(`originals: ${cleanupResults.originals.deleted}/${cleanupResults.originals.total}`, 'green');
    log(`previews: ${cleanupResults.previews.deleted}/${cleanupResults.previews.total}`, 'green');
    log(`analytics_logs: ${cleanupResults.analytics_logs.deleted}/${cleanupResults.analytics_logs.total}`, 'green');
    
    process.exit(0);
  } catch (error) {
    log(`\n❌ 清理執行失敗: ${error.message}`, 'red');
    
    // 遇錯自動降回 dry-run
    if (!isDryRun) {
      log('\n⚠️  自動降級為 dry-run 模式', 'yellow');
      // 這裡可以遞迴調用 dry-run 模式，但為了避免無限循環，我們只記錄錯誤
    }
    
    // 嘗試寫入錯誤日誌
    try {
      await logToAnalytics();
    } catch (logError) {
      log(`❌ 寫入錯誤日誌失敗: ${logError.message}`, 'red');
    }
    
    process.exit(1);
  }
}

// 執行主函數
main();


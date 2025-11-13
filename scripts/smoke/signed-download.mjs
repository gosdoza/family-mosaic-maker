#!/usr/bin/env node
/**
 * Signed Download Smoke Test
 * 
 * 流程：
 * 1. 上傳測試檔 → 取簽名 URL → 立即下載成功
 * 2. 休眠至過期 → 下載應失敗
 * 3. 將結果摘要寫入 analytics_logs(type='retention_smoke')
 * 
 * 使用方法：
 *   pnpm smoke:signed-download
 *   或
 *   node scripts/smoke/signed-download.mjs
 */

import { createClient } from '@supabase/supabase-js';

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'originals'; // 測試使用的 bucket
const SIGNED_URL_EXPIRY = 600; // 10 分鐘 = 600 秒
const TEST_FILE_NAME = `smoke-test-${Date.now()}.txt`;
const TEST_FILE_CONTENT = `Smoke test file created at ${new Date().toISOString()}`;

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

// 測試結果
const testResults = {
  upload: { success: false, error: null },
  signedUrl: { success: false, url: null, error: null },
  immediateDownload: { success: false, error: null },
  expiredDownload: { success: false, error: null },
  cleanup: { success: false, error: null },
};

/**
 * 步驟 1: 上傳測試檔
 */
async function uploadTestFile() {
  log('\n📤 步驟 1: 上傳測試檔', 'blue');
  
  try {
    // 創建測試文件 Blob
    const fileBlob = new Blob([TEST_FILE_CONTENT], { type: 'text/plain' });
    
    // 上傳文件
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(TEST_FILE_NAME, fileBlob, {
        contentType: 'text/plain',
        upsert: false
      });

    if (error) {
      throw error;
    }

    log(`✅ 文件上傳成功: ${data.path}`, 'green');
    testResults.upload.success = true;
    return data.path;
  } catch (error) {
    log(`❌ 文件上傳失敗: ${error.message}`, 'red');
    testResults.upload.error = error.message;
    throw error;
  }
}

/**
 * 步驟 2: 生成簽名 URL
 */
async function generateSignedUrl(filePath) {
  log('\n🔗 步驟 2: 生成簽名 URL', 'blue');
  
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error) {
      throw error;
    }

    log(`✅ 簽名 URL 生成成功 (有效期: ${SIGNED_URL_EXPIRY} 秒)`, 'green');
    log(`   URL: ${data.signedUrl.substring(0, 80)}...`, 'yellow');
    testResults.signedUrl.success = true;
    testResults.signedUrl.url = data.signedUrl;
    return data.signedUrl;
  } catch (error) {
    log(`❌ 簽名 URL 生成失敗: ${error.message}`, 'red');
    testResults.signedUrl.error = error.message;
    throw error;
  }
}

/**
 * 步驟 3: 立即下載（應成功）
 */
async function immediateDownload(signedUrl) {
  log('\n⬇️  步驟 3: 立即下載（應成功）', 'blue');
  
  try {
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    
    if (content === TEST_FILE_CONTENT) {
      log('✅ 立即下載成功，內容正確', 'green');
      testResults.immediateDownload.success = true;
    } else {
      throw new Error('下載內容不匹配');
    }
  } catch (error) {
    log(`❌ 立即下載失敗: ${error.message}`, 'red');
    testResults.immediateDownload.error = error.message;
    throw error;
  }
}

/**
 * 步驟 4: 等待過期後下載（應失敗）
 */
async function expiredDownload(signedUrl) {
  log('\n⏳ 步驟 4: 等待簽名 URL 過期...', 'blue');
  
  const waitTime = SIGNED_URL_EXPIRY + 10; // 多等 10 秒確保過期
  log(`   等待 ${waitTime} 秒...`, 'yellow');
  
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  
  log('\n⬇️  步驟 5: 過期後下載（應失敗）', 'blue');
  
  try {
    const response = await fetch(signedUrl);
    
    if (response.status === 403 || response.status === 401) {
      log(`✅ 過期後下載正確返回 ${response.status}`, 'green');
      testResults.expiredDownload.success = true;
    } else {
      throw new Error(`預期 403/401，實際返回 ${response.status}`);
    }
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('401')) {
      log(`✅ 過期後下載正確返回錯誤`, 'green');
      testResults.expiredDownload.success = true;
    } else {
      log(`❌ 過期後下載測試失敗: ${error.message}`, 'red');
      testResults.expiredDownload.error = error.message;
    }
  }
}

/**
 * 步驟 5: 清理測試文件
 */
async function cleanup(filePath) {
  log('\n🧹 步驟 6: 清理測試文件', 'blue');
  
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw error;
    }

    log('✅ 測試文件清理成功', 'green');
    testResults.cleanup.success = true;
  } catch (error) {
    log(`❌ 測試文件清理失敗: ${error.message}`, 'red');
    testResults.cleanup.error = error.message;
  }
}

/**
 * 步驟 6: 寫入 analytics_logs
 */
async function logToAnalytics() {
  log('\n📊 步驟 7: 寫入 analytics_logs', 'blue');
  
  try {
    const summary = {
      test: 'signed-download-smoke',
      results: {
        upload: testResults.upload.success,
        signedUrl: testResults.signedUrl.success,
        immediateDownload: testResults.immediateDownload.success,
        expiredDownload: testResults.expiredDownload.success,
        cleanup: testResults.cleanup.success,
      },
      errors: {
        upload: testResults.upload.error,
        signedUrl: testResults.signedUrl.error,
        immediateDownload: testResults.immediateDownload.error,
        expiredDownload: testResults.expiredDownload.error,
        cleanup: testResults.cleanup.error,
      },
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('analytics_logs')
      .insert({
        event_type: 'retention_smoke',
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
  log('🚀 開始簽名下載 Smoke 測試', 'blue');
  log('='.repeat(50), 'blue');
  
  let filePath = null;
  
  try {
    // 步驟 1: 上傳測試檔
    filePath = await uploadTestFile();
    
    // 步驟 2: 生成簽名 URL
    const signedUrl = await generateSignedUrl(filePath);
    
    // 步驟 3: 立即下載（應成功）
    await immediateDownload(signedUrl);
    
    // 步驟 4: 等待過期後下載（應失敗）
    await expiredDownload(signedUrl);
    
    // 步驟 5: 清理測試文件
    await cleanup(filePath);
    
    // 步驟 6: 寫入 analytics_logs
    const summary = await logToAnalytics();
    
    // 輸出測試結果摘要
    log('\n' + '='.repeat(50), 'blue');
    log('📋 測試結果摘要', 'blue');
    log('='.repeat(50), 'blue');
    log(`上傳: ${testResults.upload.success ? '✅' : '❌'}`, testResults.upload.success ? 'green' : 'red');
    log(`簽名 URL: ${testResults.signedUrl.success ? '✅' : '❌'}`, testResults.signedUrl.success ? 'green' : 'red');
    log(`立即下載: ${testResults.immediateDownload.success ? '✅' : '❌'}`, testResults.immediateDownload.success ? 'green' : 'red');
    log(`過期下載: ${testResults.expiredDownload.success ? '✅' : '❌'}`, testResults.expiredDownload.success ? 'green' : 'red');
    log(`清理: ${testResults.cleanup.success ? '✅' : '❌'}`, testResults.cleanup.success ? 'green' : 'red');
    
    const allPassed = Object.values(testResults).every(result => result.success);
    
    if (allPassed) {
      log('\n✅ 所有測試通過！', 'green');
      process.exit(0);
    } else {
      log('\n❌ 部分測試失敗', 'red');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ 測試執行失敗: ${error.message}`, 'red');
    
    // 嘗試清理
    if (filePath) {
      await cleanup(filePath);
    }
    
    // 寫入錯誤到 analytics_logs
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


# Storage CORS 配置文檔

**版本**: v1.0.0  
**最後更新**: 2025-01-16

本文档说明 Supabase Storage CORS 配置，包括允许的来源、方法和头部，以及测试步骤和故障排除。

## 📋 目錄

- [CORS 概述](#cors-概述)
- [CORS 配置](#cors-配置)
- [測試步驟](#測試步驟)
- [故障排除](#故障排除)

## 🌐 CORS 概述

### 目的

CORS（Cross-Origin Resource Sharing）配置用於允許前端應用從不同來源訪問 Supabase Storage，包括：
- 加載預覽圖片
- 上傳文件（使用簽名 URL）
- 下載文件（使用簽名 URL）

### 允許的來源

| 環境 | 來源 | 說明 |
|------|------|------|
| **Production** | `https://family-mosaic-maker.vercel.app` | 生產環境域名 |
| **Preview** | `https://family-mosaic-maker-*.vercel.app` | 預覽環境域名（通配符） |

### 允許的方法

| 方法 | 用途 | 說明 |
|------|------|------|
| **GET** | 讀取文件 | 用於下載和預覽圖片 |
| **HEAD** | 檢查文件 | 用於檢查文件是否存在 |
| **PUT** | 上傳文件 | 用於上傳文件（使用簽名 URL） |

### 允許的頭部

| 頭部 | 用途 | 說明 |
|------|------|------|
| **Authorization** | 身份驗證 | 用於攜帶 JWT token |
| **Content-Type** | 內容類型 | 用於指定文件 MIME 類型 |

### Max-Age

**Max-Age**: **600 秒**（10 分鐘）

**原因**:
- 平衡安全性和性能
- 減少 CORS 預檢請求的頻率
- 符合簽名 URL 有效期（10 分鐘）

## ⚙️ CORS 配置

### Supabase Dashboard 配置

在 Supabase Dashboard 中設置 CORS：

1. **登入 Supabase Dashboard**
2. **進入 Storage → Settings**
3. **設置 CORS 配置**:

```json
{
  "allowedOrigins": [
    "https://family-mosaic-maker.vercel.app",
    "https://family-mosaic-maker-*.vercel.app"
  ],
  "allowedMethods": ["GET", "HEAD", "PUT"],
  "allowedHeaders": ["Authorization", "Content-Type"],
  "maxAge": 600
}
```

### 程式碼配置

在應用程式代碼中設置 CORS（如果需要）：

```typescript
// 設置 CORS 頭部（如果需要）
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://family-mosaic-maker.vercel.app',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600'
};
```

## 🧪 測試步驟

### 測試場景 1: 瀏覽器 DevTools 打開一張簽名 URL 圖片：無 CORS 錯誤

**步驟**:
1. 生成一張圖片的簽名 URL
2. 在瀏覽器中打開 DevTools（F12）
3. 在 Console 中執行：
   ```javascript
   const img = new Image();
   img.src = '<簽名 URL>';
   img.onload = () => console.log('✅ 圖片加載成功');
   img.onerror = (e) => console.error('❌ 圖片加載失敗', e);
   ```
4. 檢查 Network 標籤，確認沒有 CORS 錯誤

**預期結果**: ✅ 圖片正常加載，無 CORS 錯誤

### 測試場景 2: curl -I <簽名URL> 狀態 200，Header 有 Access-Control-Allow-Origin

**步驟**:
1. 生成一張圖片的簽名 URL
2. 使用 curl 檢查響應頭：
   ```bash
   curl -I "<簽名 URL>"
   ```
3. 驗證響應頭包含：
   - `HTTP/2 200` 或 `HTTP/1.1 200 OK`
   - `Access-Control-Allow-Origin: https://family-mosaic-maker.vercel.app`
   - `Access-Control-Allow-Methods: GET, HEAD, PUT`
   - `Access-Control-Allow-Headers: Authorization, Content-Type`
   - `Access-Control-Max-Age: 600`

**預期結果**: ✅ 響應頭包含所有 CORS 相關頭部

### 測試場景 3: 前端載入預覽圖不報 CORS

**步驟**:
1. 在前端應用中加載預覽圖
2. 檢查瀏覽器 Console，確認沒有 CORS 錯誤
3. 檢查 Network 標籤，確認請求成功

**預期結果**: ✅ 預覽圖正常加載，無 CORS 錯誤

### 測試場景 4: PUT 簽名上傳不被瀏覽器攔

**步驟**:
1. 生成上傳簽名 URL
2. 在前端應用中使用 PUT 方法上傳文件
3. 檢查瀏覽器 Console，確認沒有 CORS 錯誤
4. 檢查 Network 標籤，確認上傳成功

**預期結果**: ✅ 文件上傳成功，無 CORS 錯誤

## 🔧 故障排除

### 問題 1: CORS 錯誤 "Access-Control-Allow-Origin"

**症狀**: 瀏覽器 Console 顯示 CORS 錯誤

**可能原因**:
- CORS 配置未正確設置
- 來源域名不在允許列表中
- 簽名 URL 過期

**解決方案**:
1. 檢查 Supabase Dashboard 中的 CORS 配置
2. 確認來源域名在允許列表中
3. 重新生成簽名 URL

### 問題 2: 預檢請求（OPTIONS）失敗

**症狀**: 瀏覽器發送 OPTIONS 請求失敗

**可能原因**:
- CORS 配置未包含 OPTIONS 方法
- Max-Age 設置過短

**解決方案**:
1. 確認 CORS 配置包含 OPTIONS 方法（通常自動處理）
2. 增加 Max-Age 值（建議 600 秒）

### 問題 3: 簽名 URL 無法訪問

**症狀**: 簽名 URL 返回 403 或 401

**可能原因**:
- 簽名 URL 過期
- 簽名 URL 無效
- 用戶無權限訪問

**解決方案**:
1. 檢查簽名 URL 是否過期
2. 重新生成簽名 URL
3. 確認用戶有權限訪問該文件

### 問題 4: PUT 上傳失敗

**症狀**: PUT 請求返回 CORS 錯誤

**可能原因**:
- CORS 配置未包含 PUT 方法
- 缺少必要的頭部（如 Content-Type）

**解決方案**:
1. 確認 CORS 配置包含 PUT 方法
2. 確認請求頭包含 Content-Type
3. 檢查簽名 URL 是否有效

## 📝 配置檢查清單

### Supabase Dashboard 檢查

- [ ] CORS 配置已設置
- [ ] 允許的來源包含生產和預覽域名
- [ ] 允許的方法包含 GET, HEAD, PUT
- [ ] 允許的頭部包含 Authorization, Content-Type
- [ ] Max-Age 設置為 600 秒

### 應用程式檢查

- [ ] 簽名 URL 生成正確
- [ ] 簽名 URL 有效期設置為 10 分鐘
- [ ] 前端正確處理 CORS 錯誤
- [ ] 上傳和下載功能正常

## 📚 相關文檔

- [Storage 權限策略](./storage_policy.md)
- [簽名下載 Smoke 測試](../scripts/smoke/signed-download.mjs)
- [Supabase Storage 文檔](https://supabase.com/docs/guides/storage)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，定義 Storage CORS 配置和測試步驟




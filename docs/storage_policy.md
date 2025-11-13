# Storage 權限策略文檔

**版本**: v1.0.0  
**最後更新**: 2025-01-16

本文档定义 Supabase Storage buckets 的权限策略，包括三个核心 buckets：`originals`、`previews`、`assets`，以及它们的访问规则、签名 URL 有效期和风险说明。

## 📋 目錄

- [Buckets 概述](#buckets-概述)
- [權限矩陣](#權限矩陣)
- [簽名 URL 策略](#簽名-url-策略)
- [風險說明](#風險說明)
- [實施步驟](#實施步驟)

## 🗂️ Buckets 概述

### 1. `originals` - 原圖 Bucket

**用途**: 存儲用戶上傳的原始圖片

**壽命**: 72 小時（3 天）

**字段映射**: 對應 `images` 表的 `file_path`

### 2. `previews` - 預覽圖 Bucket

**用途**: 存儲處理後的預覽圖片

**壽命**: 7 天

**字段映射**: 對應 `assets` 表的 `file_path`（`asset_type = 'preview'`）

### 3. `assets` - 高清圖 Bucket

**用途**: 存儲處理後的高清圖片

**壽命**: 長期存儲（不過期）

**字段映射**: 對應 `assets` 表的 `file_path`（`asset_type = 'hd'`）

## 🔐 權限矩陣

### 訪問規則

| Bucket | 匿名用戶 | 登入用戶 | Service Role |
|--------|---------|---------|--------------|
| **originals** | ❌ 不可讀<br>❌ 不可寫 | ✅ 可上傳<br>✅ 可讀（簽名 URL） | ✅ 可讀寫 |
| **previews** | ❌ 不可讀<br>❌ 不可寫 | ✅ 可上傳<br>✅ 可讀（簽名 URL） | ✅ 可讀寫 |
| **assets** | ❌ 不可讀<br>❌ 不可寫 | ✅ 可上傳<br>✅ 可讀（簽名 URL） | ✅ 可讀寫 |

### 權限說明

#### 1. 匿名用戶

- **讀取**: ❌ 禁止（所有 buckets）
- **寫入**: ❌ 禁止（所有 buckets）
- **原因**: 防止未授權訪問和濫用

#### 2. 登入用戶

- **讀取**: ✅ 允許（僅通過簽名 URL）
- **寫入**: ✅ 允許（僅自己的文件）
- **限制**: 
  - 只能上傳自己的文件
  - 只能通過簽名 URL 下載
  - 簽名 URL 有效期 10 分鐘

#### 3. Service Role

- **讀取**: ✅ 允許（所有文件）
- **寫入**: ✅ 允許（所有文件）
- **用途**: 後台管理、數據遷移、清理任務

## 🔗 簽名 URL 策略

### 簽名 URL 有效期

**建議有效期**: **10 分鐘**

**原因**:
- 平衡安全性和用戶體驗
- 防止 URL 被長期分享或濫用
- 符合 GDPR 數據最小化原則

### 簽名 URL 生成

**生成方式**:
```typescript
// 使用 Supabase Client 生成簽名 URL
const { data, error } = await supabase.storage
  .from('originals')
  .createSignedUrl('path/to/file.jpg', 600) // 10 分鐘 = 600 秒
```

**生成條件**:
- 用戶必須已登入
- 用戶只能為自己的文件生成簽名 URL
- 簽名 URL 包含過期時間戳和簽名

### 簽名 URL 驗證

**驗證流程**:
1. 檢查簽名是否有效
2. 檢查過期時間是否已過
3. 檢查用戶是否有權限訪問該文件

**過期處理**:
- 過期後返回 `403 Forbidden` 或 `401 Unauthorized`
- 前端應重新生成簽名 URL

### 簽名 URL 使用場景

| 場景 | 有效期 | 說明 |
|------|--------|------|
| **即時下載** | 10 分鐘 | 用戶點擊下載按鈕時生成 |
| **預覽圖顯示** | 10 分鐘 | 用戶查看預覽圖時生成 |
| **分享連結** | 10 分鐘 | 用戶分享圖片時生成（短期分享） |

## ⚠️ 風險說明

### 1. 簽名 URL 過期風險

**風險**: 簽名 URL 過期後無法訪問

**緩解措施**:
- 前端自動重新生成簽名 URL
- 提供友好的錯誤提示
- 記錄過期事件以便監控

### 2. 簽名 URL 洩露風險

**風險**: 簽名 URL 被分享或洩露

**緩解措施**:
- 設置較短的有效期（10 分鐘）
- 限制簽名 URL 的使用次數（可選）
- 監控異常訪問模式

### 3. 匿名訪問風險

**風險**: 匿名用戶直接訪問文件

**緩解措施**:
- 所有 buckets 設置為私有
- 禁止匿名用戶讀取和寫入
- 僅通過簽名 URL 訪問

### 4. 存儲成本風險

**風險**: 長期存儲導致成本增加

**緩解措施**:
- `originals`: 72 小時後自動清理
- `previews`: 7 天後自動清理
- `assets`: 僅在用戶主動刪除或訂單退款時清理

## 📝 實施步驟

### 步驟 1: 創建 Buckets

在 Supabase Dashboard 中創建三個 buckets：

1. **originals**
   - 設置為私有（Private）
   - 啟用文件版本控制（可選）

2. **previews**
   - 設置為私有（Private）
   - 啟用文件版本控制（可選）

3. **assets**
   - 設置為私有（Private）
   - 啟用文件版本控制（可選）

### 步驟 2: 設置 Bucket 策略

在 Supabase Dashboard 中設置 bucket 策略：

```sql
-- originals bucket 策略
-- 僅登入用戶可上傳
-- 僅登入用戶可讀取（通過簽名 URL）

-- previews bucket 策略
-- 僅登入用戶可上傳
-- 僅登入用戶可讀取（通過簽名 URL）

-- assets bucket 策略
-- 僅登入用戶可上傳
-- 僅登入用戶可讀取（通過簽名 URL）
```

### 步驟 3: 設置 RLS 策略

在 Supabase Dashboard 中設置 Storage RLS 策略：

```sql
-- 禁止匿名用戶訪問
CREATE POLICY "Anonymous users cannot access storage"
ON storage.objects FOR SELECT
USING (auth.role() = 'authenticated');

-- 允許登入用戶上傳自己的文件
CREATE POLICY "Authenticated users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND bucket_id IN ('originals', 'previews', 'assets'));

-- 允許登入用戶讀取自己的文件（通過簽名 URL）
CREATE POLICY "Authenticated users can read their own files"
ON storage.objects FOR SELECT
USING (auth.role() = 'authenticated' AND bucket_id IN ('originals', 'previews', 'assets'));
```

### 步驟 4: 實施簽名 URL 生成

在應用程式代碼中實施簽名 URL 生成：

```typescript
// 生成簽名 URL（10 分鐘有效期）
async function generateSignedUrl(bucket: string, filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 600); // 10 分鐘 = 600 秒

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
```

## 🧪 驗收測試

### 測試場景 1: 本地上傳一張檔 → 產生簽名連結 → 開啟成功

**步驟**:
1. 登入用戶上傳一張圖片到 `originals` bucket
2. 生成簽名 URL（有效期 10 分鐘）
3. 使用瀏覽器打開簽名 URL
4. 驗證圖片可以正常顯示

**預期結果**: ✅ 圖片正常顯示

### 測試場景 2: 等簽名過期再打 → 應 403/401

**步驟**:
1. 生成簽名 URL（有效期 10 分鐘）
2. 等待 11 分鐘（超過有效期）
3. 嘗試訪問簽名 URL
4. 驗證返回 `403 Forbidden` 或 `401 Unauthorized`

**預期結果**: ✅ 返回 `403` 或 `401` 錯誤

### 測試場景 3: Supabase Dashboard 檢視 buckets 存取規則無誤

**步驟**:
1. 登入 Supabase Dashboard
2. 進入 Storage → Buckets
3. 檢查三個 buckets 的設置：
   - `originals`: 私有，僅登入用戶可訪問
   - `previews`: 私有，僅登入用戶可訪問
   - `assets`: 私有，僅登入用戶可訪問
4. 檢查 RLS 策略是否正確設置

**預期結果**: ✅ 所有 buckets 設置正確

## 📚 相關文檔

- [資料庫架構文檔](./db_schema.md)
- [Storage CORS 配置](./storage_cors.md)
- [簽名下載 Smoke 測試](../scripts/smoke/signed-download.mjs)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，定義 Storage buckets 權限策略和簽名 URL 策略




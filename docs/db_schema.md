# 資料庫架構文檔

**版本**: v1.0.0  
**最後更新**: 2025-01-16

本文档定义 MVP 数据库架构，包括六张核心表：`images`、`assets`、`orders`、`feature_flags`、`analytics_logs`、`gdpr_requests`，以及它们的字段定义、RLS 策略和迁移规则。

## 📋 目錄

- [表結構](#表結構)
- [Row Level Security (RLS)](#row-level-security-rls)
- [索引](#索引)
- [遷移文件](#遷移文件)

## 📊 表結構

### 1. `images` - 原圖表

**用途**: 存儲用戶上傳的原始圖片

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 圖片唯一標識 |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | 用戶 ID |
| `job_id` | `text` | NOT NULL | 關聯的任務 ID |
| `original_filename` | `text` | NOT NULL | 原始文件名 |
| `file_path` | `text` | NOT NULL | 存儲路徑（Supabase Storage） |
| `file_size` | `bigint` | NOT NULL | 文件大小（字節） |
| `mime_type` | `text` | NOT NULL | MIME 類型（如 image/jpeg） |
| `width` | `integer` | | 圖片寬度（像素） |
| `height` | `integer` | | 圖片高度（像素） |
| `uploaded_at` | `timestamptz` | NOT NULL, DEFAULT now() | 上傳時間 |
| `expires_at` | `timestamptz` | NOT NULL | 過期時間（上傳後 72 小時） |
| `deleted_at` | `timestamptz` | | 刪除時間（軟刪除） |

**約束**:
- `expires_at > uploaded_at` (CHECK)

**索引**:
- `idx_images_user_id` ON `user_id`
- `idx_images_job_id` ON `job_id`
- `idx_images_expires_at` ON `expires_at`
- `idx_images_deleted_at` ON `deleted_at` WHERE `deleted_at IS NOT NULL`

### 2. `assets` - 資源表（預覽與高清）

**用途**: 存儲處理後的圖片資源（預覽圖和高清圖）

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 資源唯一標識 |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | 用戶 ID |
| `job_id` | `text` | NOT NULL | 關聯的任務 ID |
| `image_id` | `uuid` | REFERENCES images(id) ON DELETE SET NULL | 關聯的原圖 ID |
| `asset_type` | `text` | NOT NULL, CHECK (asset_type IN ('preview', 'hd')) | 資源類型（預覽/高清） |
| `file_path` | `text` | NOT NULL | 存儲路徑（Supabase Storage） |
| `file_size` | `bigint` | NOT NULL | 文件大小（字節） |
| `mime_type` | `text` | NOT NULL | MIME 類型 |
| `width` | `integer` | | 圖片寬度（像素） |
| `height` | `integer` | | 圖片高度（像素） |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |
| `expires_at` | `timestamptz` | | 過期時間（預覽：7天，高清：NULL） |
| `deleted_at` | `timestamptz` | | 刪除時間（軟刪除） |

**約束**:
- `asset_type IN ('preview', 'hd')` (CHECK)
- `(asset_type = 'preview' AND expires_at IS NOT NULL) OR (asset_type = 'hd' AND expires_at IS NULL)` (CHECK)

**索引**:
- `idx_assets_user_id` ON `user_id`
- `idx_assets_job_id` ON `job_id`
- `idx_assets_image_id` ON `image_id`
- `idx_assets_asset_type` ON `asset_type`
- `idx_assets_expires_at` ON `expires_at` WHERE `expires_at IS NOT NULL`
- `idx_assets_deleted_at` ON `deleted_at` WHERE `deleted_at IS NOT NULL`

### 3. `orders` - 訂單表

**用途**: 存儲支付訂單記錄

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 訂單唯一標識 |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | 用戶 ID |
| `job_id` | `text` | NOT NULL | 關聯的任務 ID |
| `status` | `text` | NOT NULL, DEFAULT 'pending', CHECK (status IN ('pending', 'approved', 'paid', 'failed', 'refunded')) | 訂單狀態 |
| `amount_cents` | `integer` | NOT NULL, DEFAULT 299 | 金額（分） |
| `currency` | `text` | NOT NULL, DEFAULT 'USD' | 貨幣 |
| `paypal_order_id` | `text` | | PayPal 訂單 ID |
| `paypal_capture_id` | `text` | | PayPal 捕獲 ID |
| `payer_email` | `text` | | 付款人 Email |
| `approval_url` | `text` | | PayPal 批准 URL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 更新時間 |
| `paid_at` | `timestamptz` | | 付款時間 |

**約束**:
- `status IN ('pending', 'approved', 'paid', 'failed', 'refunded')` (CHECK)

**索引**:
- `idx_orders_user_id` ON `user_id`
- `idx_orders_job_id` ON `job_id`
- `idx_orders_status` ON `status`
- `idx_orders_paypal_order_id` ON `paypal_order_id` WHERE `paypal_order_id IS NOT NULL`

### 4. `feature_flags` - 功能開關表

**用途**: 存儲功能開關配置

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 功能開關唯一標識 |
| `flag_key` | `text` | NOT NULL, UNIQUE | 功能開關鍵名 |
| `flag_value` | `boolean` | NOT NULL, DEFAULT false | 功能開關值 |
| `description` | `text` | | 功能開關描述 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 更新時間 |

**索引**:
- `idx_feature_flags_key` ON `flag_key`

### 5. `analytics_logs` - 分析日誌表

**用途**: 存儲分析日誌記錄

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 日誌唯一標識 |
| `user_id` | `uuid` | REFERENCES auth.users(id) ON DELETE SET NULL | 用戶 ID（可選） |
| `event_type` | `text` | NOT NULL | 事件類型 |
| `event_data` | `jsonb` | | 事件數據（JSON） |
| `ip_hash` | `text` | | IP 地址的 SHA-256 雜湊值 |
| `user_agent_hash` | `text` | | User Agent 的 SHA-256 雜湊值 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |

**索引**:
- `idx_analytics_logs_user_id` ON `user_id`
- `idx_analytics_logs_event_type` ON `event_type`
- `idx_analytics_logs_created_at` ON `created_at`

### 6. `gdpr_requests` - GDPR 請求表

**用途**: 存儲 GDPR 請求記錄

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 請求唯一標識 |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | 用戶 ID |
| `request_type` | `text` | NOT NULL, CHECK (request_type IN ('export', 'delete', 'rectify')) | 請求類型 |
| `status` | `text` | NOT NULL, DEFAULT 'pending', CHECK (status IN ('pending', 'processing', 'completed', 'failed')) | 請求狀態 |
| `request_data` | `jsonb` | | 請求數據（JSON） |
| `response_data` | `jsonb` | | 響應數據（JSON） |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 更新時間 |
| `completed_at` | `timestamptz` | | 完成時間 |

**約束**:
- `request_type IN ('export', 'delete', 'rectify')` (CHECK)
- `status IN ('pending', 'processing', 'completed', 'failed')` (CHECK)

**索引**:
- `idx_gdpr_requests_user_id` ON `user_id`
- `idx_gdpr_requests_type` ON `request_type`
- `idx_gdpr_requests_status` ON `status`

## 🔒 Row Level Security (RLS)

### RLS 啟用狀態

所有表都已啟用 RLS：

```sql
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
```

### RLS 策略規則

#### 1. `images` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | `auth.uid() = user_id` | 僅本人可查看自己的圖片 |
| **INSERT** | `auth.uid() = user_id` | 僅本人可插入自己的圖片 |
| **UPDATE** | `auth.uid() = user_id` | 僅本人可更新自己的圖片 |
| **DELETE** | ❌ **禁止** | 禁止物理刪除，使用軟刪除 |

#### 2. `assets` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | `auth.uid() = user_id` | 僅本人可查看自己的資源 |
| **INSERT** | `auth.uid() = user_id` | 僅本人可插入自己的資源 |
| **UPDATE** | `auth.uid() = user_id` | 僅本人可更新自己的資源 |
| **DELETE** | ❌ **禁止** | 禁止物理刪除，使用軟刪除 |

#### 3. `orders` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | `auth.uid() = user_id` | 僅本人可查看自己的訂單 |
| **INSERT** | `auth.uid() = user_id` | 僅本人可插入自己的訂單 |
| **UPDATE** | `auth.uid() = user_id` | 僅本人可更新自己的訂單 |
| **DELETE** | ❌ **禁止** | 禁止物理刪除 |

#### 4. `feature_flags` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | ❌ **禁止**（一般用戶） | 一般用戶無法查看，僅 admin 可查看 |
| **INSERT** | ❌ **禁止**（一般用戶） | 僅 admin 可插入（使用 Service Role） |
| **UPDATE** | ❌ **禁止**（一般用戶） | 僅 admin 可更新（使用 Service Role） |
| **DELETE** | ❌ **禁止** | 禁止物理刪除 |

#### 5. `analytics_logs` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | ❌ **禁止**（一般用戶） | 預設不可被一般用戶 select（僅 admin 視圖可查） |
| **INSERT** | ✅ **允許**（系統） | 僅系統可插入（使用 Service Role 或特殊策略） |
| **UPDATE** | ❌ **禁止** | 禁止更新 |
| **DELETE** | ❌ **禁止** | 禁止物理刪除 |

#### 6. `gdpr_requests` 表策略

| 操作 | 策略 | 說明 |
|------|------|------|
| **SELECT** | `auth.uid() = user_id` | 僅本人可查看自己的 GDPR 請求 |
| **INSERT** | `auth.uid() = user_id` | 僅本人可插入自己的 GDPR 請求 |
| **UPDATE** | `auth.uid() = user_id` | 僅本人可更新自己的 GDPR 請求 |
| **DELETE** | ❌ **禁止** | 禁止物理刪除 |

### RLS 策略實現

詳細的 RLS 策略實現請參考 `/supabase/policies.sql` 文件。

## 📊 索引

### 索引總結表

| 表名 | 索引名稱 | 索引字段 | 說明 |
|------|---------|---------|------|
| **images** | `idx_images_user_id` | `user_id` | 用戶 ID 索引 |
| **images** | `idx_images_job_id` | `job_id` | 任務 ID 索引 |
| **images** | `idx_images_expires_at` | `expires_at` | 過期時間索引 |
| **images** | `idx_images_deleted_at` | `deleted_at` | 刪除時間索引（部分索引） |
| **assets** | `idx_assets_user_id` | `user_id` | 用戶 ID 索引 |
| **assets** | `idx_assets_job_id` | `job_id` | 任務 ID 索引 |
| **assets** | `idx_assets_image_id` | `image_id` | 原圖 ID 索引 |
| **assets** | `idx_assets_asset_type` | `asset_type` | 資源類型索引 |
| **assets** | `idx_assets_expires_at` | `expires_at` | 過期時間索引（部分索引） |
| **assets** | `idx_assets_deleted_at` | `deleted_at` | 刪除時間索引（部分索引） |
| **orders** | `idx_orders_user_id` | `user_id` | 用戶 ID 索引 |
| **orders** | `idx_orders_job_id` | `job_id` | 任務 ID 索引 |
| **orders** | `idx_orders_status` | `status` | 訂單狀態索引 |
| **orders** | `idx_orders_paypal_order_id` | `paypal_order_id` | PayPal 訂單 ID 索引（部分索引） |
| **feature_flags** | `idx_feature_flags_key` | `flag_key` | 功能開關鍵名索引 |
| **analytics_logs** | `idx_analytics_logs_user_id` | `user_id` | 用戶 ID 索引 |
| **analytics_logs** | `idx_analytics_logs_event_type` | `event_type` | 事件類型索引 |
| **analytics_logs** | `idx_analytics_logs_created_at` | `created_at` | 創建時間索引 |
| **gdpr_requests** | `idx_gdpr_requests_user_id` | `user_id` | 用戶 ID 索引 |
| **gdpr_requests** | `idx_gdpr_requests_type` | `request_type` | 請求類型索引 |
| **gdpr_requests** | `idx_gdpr_requests_status` | `status` | 請求狀態索引 |

## 📝 遷移文件

### 遷移文件列表

1. **`20250116000000_create_mvp_tables.sql`**
   - 創建 6 張表：`images`, `assets`, `orders`, `feature_flags`, `analytics_logs`, `gdpr_requests`
   - 創建索引
   - 創建約束

2. **`policies.sql`**
   - 啟用 RLS
   - 創建 RLS 策略

### 遷移執行順序

1. **執行表創建遷移**:
   ```bash
   supabase db push
   # 或
   # 在 Supabase Dashboard SQL Editor 中執行
   # supabase/migrations/20250116000000_create_mvp_tables.sql
   ```

2. **執行 RLS 策略遷移**:
   ```bash
   # 在 Supabase Dashboard SQL Editor 中執行
   # supabase/policies.sql
   ```

### 遷移驗證

**驗證表是否創建**:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('images', 'assets', 'orders', 'feature_flags', 'analytics_logs', 'gdpr_requests')
ORDER BY table_name;
```

**驗證 RLS 是否啟用**:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders', 'feature_flags', 'analytics_logs', 'gdpr_requests')
ORDER BY tablename;
```

**驗證 RLS 策略**:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders', 'feature_flags', 'analytics_logs', 'gdpr_requests')
ORDER BY tablename, policyname;
```

## 🧪 測試驗證

### RLS 測試場景

#### 1. 交叉查詢測試（兩個不同帳號）

**測試步驟**:
1. 使用帳號 A 創建一條記錄
2. 使用帳號 B 嘗試查詢帳號 A 的記錄
3. 驗證帳號 B 無法查詢到帳號 A 的記錄

**測試 SQL**:
```sql
-- 帳號 A 創建記錄
INSERT INTO public.images (user_id, job_id, original_filename, file_path, file_size, mime_type, expires_at)
VALUES (auth.uid(), 'job-001', 'test.jpg', '/uploads/test.jpg', 1024, 'image/jpeg', now() + INTERVAL '72 hours')
RETURNING id;

-- 帳號 B 嘗試查詢（應該返回空結果）
SELECT * FROM public.images WHERE id = '<帳號 A 創建的 id>';
-- 預期：空結果集（0 行）
```

#### 2. DELETE 操作測試

**測試步驟**:
1. 使用帳號 A 創建一條記錄
2. 嘗試對該記錄執行 DELETE
3. 驗證 DELETE 操作被拒絕

**測試 SQL**:
```sql
-- 帳號 A 創建記錄
INSERT INTO public.images (user_id, job_id, original_filename, file_path, file_size, mime_type, expires_at)
VALUES (auth.uid(), 'job-001', 'test.jpg', '/uploads/test.jpg', 1024, 'image/jpeg', now() + INTERVAL '72 hours')
RETURNING id;

-- 嘗試 DELETE（應該被拒絕）
DELETE FROM public.images WHERE id = '<創建的 id>';
-- 預期：錯誤 "permission denied for table images" 或 "new row violates row-level security policy"
```

#### 3. 軟刪除測試

**測試步驟**:
1. 使用帳號 A 創建一條記錄
2. 使用 UPDATE 設置 `deleted_at = now()`
3. 驗證軟刪除成功

**測試 SQL**:
```sql
-- 帳號 A 創建記錄
INSERT INTO public.images (user_id, job_id, original_filename, file_path, file_size, mime_type, expires_at)
VALUES (auth.uid(), 'job-001', 'test.jpg', '/uploads/test.jpg', 1024, 'image/jpeg', now() + INTERVAL '72 hours')
RETURNING id;

-- 軟刪除（應該成功）
UPDATE public.images
SET deleted_at = now()
WHERE id = '<創建的 id>'
RETURNING id, deleted_at;
-- 預期：返回更新後的記錄，deleted_at 不為 NULL
```

#### 4. analytics_logs 訪問測試

**測試步驟**:
1. 使用一般用戶帳號嘗試查詢 `analytics_logs`
2. 驗證查詢被拒絕

**測試 SQL**:
```sql
-- 一般用戶嘗試查詢（應該被拒絕）
SELECT * FROM public.analytics_logs LIMIT 10;
-- 預期：錯誤 "permission denied for table analytics_logs" 或空結果集（如果策略允許但無數據）
```

## 📚 相關文檔

- [RLS 基準策略](./rls-policy.md)
- [最小資料庫架構](./min-schema.md)
- [資料保留策略](./retention.md)

## 📝 管理視圖

### 管理視圖列表

| 視圖名稱 | 用途 | 權限要求 |
|---------|------|---------|
| **admin_analytics_logs** | 分析日誌管理視圖 | 僅 service role 可查詢 |
| **admin_feature_flags** | 功能開關管理視圖 | 僅 service role 可查詢 |

### 管理視圖說明

詳細的管理視圖使用說明請參考 [管理視圖文檔](./admin-views.md)。

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，定義 6 張 MVP 表和 RLS 策略


# 最小資料庫架構

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档定义最小数据库架构，包括三个核心表：`images`、`assets`、`orders`，以及它们的字段定义、寿命策略和迁移规则。

## 📋 目錄

- [表結構](#表結構)
- [壽命策略](#壽命策略)
- [Row Level Security (RLS)](#row-level-security-rls)
- [遷移命名規則](#遷移命名規則)
- [回滾手順](#回滾手順)

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

**索引**:
```sql
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_job_id ON images(job_id);
CREATE INDEX idx_images_expires_at ON images(expires_at);
CREATE INDEX idx_images_deleted_at ON images(deleted_at) WHERE deleted_at IS NOT NULL;
```

**SQL 定義**:
```sql
CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  original_filename text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  
  CONSTRAINT images_expires_at_check CHECK (expires_at > uploaded_at)
);

CREATE INDEX idx_images_user_id ON public.images(user_id);
CREATE INDEX idx_images_job_id ON public.images(job_id);
CREATE INDEX idx_images_expires_at ON public.images(expires_at);
CREATE INDEX idx_images_deleted_at ON public.images(deleted_at) WHERE deleted_at IS NOT NULL;
```

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

**索引**:
```sql
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_job_id ON assets(job_id);
CREATE INDEX idx_assets_image_id ON assets(image_id);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_expires_at ON assets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_assets_deleted_at ON assets(deleted_at) WHERE deleted_at IS NOT NULL;
```

**SQL 定義**:
```sql
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  image_id uuid REFERENCES public.images(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('preview', 'hd')),
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  
  CONSTRAINT assets_preview_expires_check CHECK (
    (asset_type = 'preview' AND expires_at IS NOT NULL) OR
    (asset_type = 'hd' AND expires_at IS NULL)
  )
);

CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_assets_job_id ON public.assets(job_id);
CREATE INDEX idx_assets_image_id ON public.assets(image_id);
CREATE INDEX idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX idx_assets_expires_at ON public.assets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_assets_deleted_at ON public.assets(deleted_at) WHERE deleted_at IS NOT NULL;
```

### 3. `orders` - 訂單表

**用途**: 存儲支付訂單記錄

**字段定義**:

| 字段名稱 | 類型 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | 訂單唯一標識 |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | 用戶 ID |
| `job_id` | `text` | NOT NULL | 關聯的任務 ID |
| `status` | `text` | NOT NULL, CHECK (status IN ('pending', 'approved', 'paid', 'failed', 'refunded')) | 訂單狀態 |
| `amount_cents` | `integer` | NOT NULL, DEFAULT 299 | 金額（分） |
| `currency` | `text` | NOT NULL, DEFAULT 'USD' | 貨幣 |
| `paypal_order_id` | `text` | | PayPal 訂單 ID |
| `paypal_capture_id` | `text` | | PayPal 捕獲 ID |
| `payer_email` | `text` | | 付款人 Email |
| `approval_url` | `text` | | PayPal 批准 URL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | 創建時間 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | 更新時間 |
| `paid_at` | `timestamptz` | | 付款時間 |

**索引**:
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_job_id ON orders(job_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_paypal_order_id ON orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
```

**SQL 定義**:
```sql
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'failed', 'refunded')),
  amount_cents integer NOT NULL DEFAULT 299,
  currency text NOT NULL DEFAULT 'USD',
  paypal_order_id text,
  paypal_capture_id text,
  payer_email text,
  approval_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_job_id ON public.orders(job_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_paypal_order_id ON public.orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
```

## ⏰ 壽命策略

### 刪除策略

**1. 原圖 (`images`)**
- **壽命**: 72 小時（3 天）
- **策略**: 上傳後 72 小時自動過期
- **實現**: 設置 `expires_at = uploaded_at + INTERVAL '72 hours'`
- **清理**: 定期任務刪除 `expires_at < now()` 且 `deleted_at IS NULL` 的記錄

**2. 預覽圖 (`assets`, `asset_type = 'preview'`)**
- **壽命**: 7 天
- **策略**: 創建後 7 天自動過期
- **實現**: 設置 `expires_at = created_at + INTERVAL '7 days'`
- **清理**: 定期任務刪除 `expires_at < now()` 且 `deleted_at IS NULL` 的記錄

**3. 高清圖 (`assets`, `asset_type = 'hd'`)**
- **壽命**: 長期存儲（不過期）
- **策略**: `expires_at = NULL`（永不過期）
- **清理**: 僅在用戶主動刪除或訂單退款時刪除

### 自動清理函數

```sql
-- 清理過期的原圖（72小時）
CREATE OR REPLACE FUNCTION cleanup_expired_images()
RETURNS void AS $$
BEGIN
  UPDATE public.images
  SET deleted_at = now()
  WHERE expires_at < now()
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 清理過期的預覽圖（7天）
CREATE OR REPLACE FUNCTION cleanup_expired_preview_assets()
RETURNS void AS $$
BEGIN
  UPDATE public.assets
  SET deleted_at = now()
  WHERE asset_type = 'preview'
    AND expires_at < now()
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### 定期任務設置

**使用 Supabase Cron Jobs**:

```sql
-- 每小時執行一次清理過期原圖
SELECT cron.schedule(
  'cleanup-expired-images',
  '0 * * * *', -- 每小時的 0 分
  $$SELECT cleanup_expired_images()$$
);

-- 每天執行一次清理過期預覽圖
SELECT cron.schedule(
  'cleanup-expired-preview-assets',
  '0 2 * * *', -- 每天凌晨 2 點
  $$SELECT cleanup_expired_preview_assets()$$
);
```

## 🔒 Row Level Security (RLS)

### 啟用 RLS

```sql
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
```

### RLS 策略

#### `images` 表策略

```sql
-- 用戶只能查看自己的圖片
CREATE POLICY "Users can view their own images"
  ON public.images FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能插入自己的圖片
CREATE POLICY "Users can insert their own images"
  ON public.images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能更新自己的圖片
CREATE POLICY "Users can update their own images"
  ON public.images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能刪除自己的圖片（軟刪除）
CREATE POLICY "Users can delete their own images"
  ON public.images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);
```

#### `assets` 表策略

```sql
-- 用戶只能查看自己的資源
CREATE POLICY "Users can view their own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能插入自己的資源
CREATE POLICY "Users can insert their own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能更新自己的資源
CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能刪除自己的資源（軟刪除）
CREATE POLICY "Users can delete their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);
```

#### `orders` 表策略

```sql
-- 用戶只能查看自己的訂單
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能插入自己的訂單
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能更新自己的訂單
CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## 📝 遷移命名規則

### 遷移文件命名格式

```
YYYYMMDDHHMMSS_description.sql
```

**格式說明**:
- `YYYYMMDDHHMMSS`: 時間戳（年-月-日-時-分-秒）
- `description`: 簡短描述（小寫，使用下劃線分隔）

**範例**:
```
20251109140000_create_min_schema.sql
20251109150000_add_cleanup_functions.sql
20251109160000_add_rls_policies.sql
```

### 遷移文件結構

每個遷移文件應包含：

1. **文件頭註釋**:
```sql
-- Migration: <description>
-- Version: v1.0.0
-- Created: YYYY-MM-DD HH:MM:SS
-- Description: <詳細說明>
```

2. **遷移內容**:
```sql
-- 創建表、索引、函數等
```

3. **回滾註釋**（可選）:
```sql
-- Rollback:
-- DROP TABLE IF EXISTS public.images CASCADE;
-- DROP TABLE IF EXISTS public.assets CASCADE;
-- DROP TABLE IF EXISTS public.orders CASCADE;
```

### 遷移執行順序

1. **基礎表結構** (`20251109140000_create_min_schema.sql`)
   - 創建 `images` 表
   - 創建 `assets` 表
   - 創建 `orders` 表
   - 創建索引

2. **清理函數** (`20251109150000_add_cleanup_functions.sql`)
   - 創建 `cleanup_expired_images()` 函數
   - 創建 `cleanup_expired_preview_assets()` 函數

3. **RLS 策略** (`20251109160000_add_rls_policies.sql`)
   - 啟用 RLS
   - 創建 RLS 策略

4. **定期任務** (`20251109170000_add_cron_jobs.sql`)
   - 設置 Cron Jobs

### 遷移執行命令

```bash
# 使用 Supabase CLI
supabase db push

# 或使用 Supabase Dashboard SQL Editor
# 按順序執行遷移文件
```

## 🔄 回滾手順

### 回滾前準備

1. **備份數據庫**
   ```bash
   # 使用 Supabase CLI 備份
   supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **確認當前遷移版本**
   ```sql
   -- 查看遷移歷史
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC
   LIMIT 10;
   ```

### 回滾步驟

#### 步驟 1: 停止定期任務

```sql
-- 刪除 Cron Jobs
SELECT cron.unschedule('cleanup-expired-images');
SELECT cron.unschedule('cleanup-expired-preview-assets');
```

#### 步驟 2: 刪除 RLS 策略

```sql
-- 刪除 images 表策略
DROP POLICY IF EXISTS "Users can view their own images" ON public.images;
DROP POLICY IF EXISTS "Users can insert their own images" ON public.images;
DROP POLICY IF EXISTS "Users can update their own images" ON public.images;
DROP POLICY IF EXISTS "Users can delete their own images" ON public.images;

-- 刪除 assets 表策略
DROP POLICY IF EXISTS "Users can view their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;

-- 刪除 orders 表策略
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
```

#### 步驟 3: 禁用 RLS

```sql
ALTER TABLE public.images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
```

#### 步驟 4: 刪除清理函數

```sql
DROP FUNCTION IF EXISTS cleanup_expired_images();
DROP FUNCTION IF EXISTS cleanup_expired_preview_assets();
```

#### 步驟 5: 刪除表（謹慎操作）

**⚠️ 警告**: 刪除表會永久刪除所有數據，請確保已備份！

```sql
-- 刪除表（按依賴順序）
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.images CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
```

### 完整回滾腳本

創建回滾遷移文件：`20251109180000_rollback_min_schema.sql`

```sql
-- Migration: Rollback min schema
-- Version: v1.0.0
-- Created: 2025-11-09 18:00:00
-- Description: 回滾最小架構遷移

-- 步驟 1: 停止定期任務
SELECT cron.unschedule('cleanup-expired-images');
SELECT cron.unschedule('cleanup-expired-preview-assets');

-- 步驟 2: 刪除 RLS 策略
DROP POLICY IF EXISTS "Users can view their own images" ON public.images;
DROP POLICY IF EXISTS "Users can insert their own images" ON public.images;
DROP POLICY IF EXISTS "Users can update their own images" ON public.images;
DROP POLICY IF EXISTS "Users can delete their own images" ON public.images;

DROP POLICY IF EXISTS "Users can view their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;

-- 步驟 3: 禁用 RLS
ALTER TABLE public.images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- 步驟 4: 刪除清理函數
DROP FUNCTION IF EXISTS cleanup_expired_images();
DROP FUNCTION IF EXISTS cleanup_expired_preview_assets();

-- 步驟 5: 刪除表（謹慎操作！）
-- DROP TABLE IF EXISTS public.assets CASCADE;
-- DROP TABLE IF EXISTS public.images CASCADE;
-- DROP TABLE IF EXISTS public.orders CASCADE;
```

### 回滾驗證

```sql
-- 驗證表是否已刪除
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('images', 'assets', 'orders');

-- 預期：無結果（表已刪除）
```

## 📚 相關文檔

- [Database Schema](../database-schema.md)
- [Migration Guide](../MIGRATION_GUIDE.md)
- [Supabase Storage 配置](../deploy/supabase-auth-config-status.md)

## 🔧 工具和命令

### 創建遷移文件

```bash
# 使用 Supabase CLI 創建遷移
supabase migration new create_min_schema

# 編輯遷移文件
# supabase/migrations/YYYYMMDDHHMMSS_create_min_schema.sql
```

### 執行遷移

```bash
# 推送遷移
supabase db push

# 或重置數據庫（開發環境）
supabase db reset
```

### 驗證遷移

```sql
-- 檢查表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('images', 'assets', 'orders');

-- 檢查索引
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders');

-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders');
```

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義最小三表架構




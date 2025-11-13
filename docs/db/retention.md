# Retention & TTL 運維說明

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档描述数据保留策略、清理排程和运维流程，包括清理策略、观测字段和误删回滚手顺。

## 📋 目錄

- [保留策略](#保留策略)
- [清理排程](#清理排程)
- [觀測欄位](#觀測欄位)
- [清理流程](#清理流程)
- [風險提示](#風險提示)
- [誤刪回滾手順](#誤刪回滾手順)

## ⏰ 保留策略

### 數據保留期限

| 表/資源類型 | 保留期限 | 說明 |
|------------|---------|------|
| `images` (原圖) | **72 小時** (3 天) | 用戶上傳的原始圖片 |
| `assets` (預覽圖) | **7 天** | 處理後的預覽圖片 |
| `assets` (高清圖) | **長期存儲** | 付費下載的高清圖片（不過期） |
| `analytics_logs` | **180 天** (6 個月) | 分析日誌記錄 |

### 保留策略詳情

#### 1. `images` - 原圖（72 小時）

**保留期限**: 72 小時（3 天）

**策略**:
- 上傳後 72 小時自動過期
- 使用 `expires_at` 字段標記過期時間
- 過期後使用軟刪除（設置 `deleted_at`）

**計算方式**:
```sql
expires_at = uploaded_at + INTERVAL '72 hours'
```

**清理觸發**:
- 每小時執行一次清理任務
- 清理條件: `expires_at < now() AND deleted_at IS NULL`

#### 2. `assets` - 預覽圖（7 天）

**保留期限**: 7 天

**策略**:
- 創建後 7 天自動過期
- 使用 `expires_at` 字段標記過期時間
- 過期後使用軟刪除（設置 `deleted_at`）

**計算方式**:
```sql
expires_at = created_at + INTERVAL '7 days'
```

**清理觸發**:
- 每天執行一次清理任務（凌晨 2 點）
- 清理條件: `asset_type = 'preview' AND expires_at < now() AND deleted_at IS NULL`

#### 3. `assets` - 高清圖（長期存儲）

**保留期限**: 長期存儲（不過期）

**策略**:
- `expires_at = NULL`（永不過期）
- 僅在用戶主動刪除或訂單退款時刪除
- 使用軟刪除（設置 `deleted_at`）

**清理觸發**:
- 不自動清理
- 僅手動刪除或訂單退款時清理

#### 4. `analytics_logs` - 分析日誌（180 天）

**保留期限**: 180 天（6 個月）

**策略**:
- 創建後 180 天自動過期
- 使用 `created_at` 字段計算過期時間
- 過期後物理刪除（不保留）

**計算方式**:
```sql
created_at < now() - INTERVAL '180 days'
```

**清理觸發**:
- 每週執行一次清理任務（週日凌晨 3 點）
- 清理條件: `created_at < now() - INTERVAL '180 days'`

## 📅 清理排程

### 排程設置

使用 Supabase Cron Jobs 設置定期清理任務：

```sql
-- 1. 清理過期原圖（每小時執行）
SELECT cron.schedule(
  'cleanup-expired-images',
  '0 * * * *', -- 每小時的 0 分
  $$SELECT cleanup_expired_images()$$
);

-- 2. 清理過期預覽圖（每天執行）
SELECT cron.schedule(
  'cleanup-expired-preview-assets',
  '0 2 * * *', -- 每天凌晨 2 點
  $$SELECT cleanup_expired_preview_assets()$$
);

-- 3. 清理過期分析日誌（每週執行）
SELECT cron.schedule(
  'cleanup-expired-analytics-logs',
  '0 3 * * 0', -- 每週日凌晨 3 點
  $$SELECT cleanup_expired_analytics_logs()$$
);
```

### 排程詳情

| 任務名稱 | 頻率 | 執行時間 | 清理對象 | 保留期限 |
|---------|------|---------|---------|---------|
| `cleanup-expired-images` | 每小時 | 每小時 0 分 | `images` 原圖 | 72 小時 |
| `cleanup-expired-preview-assets` | 每天 | 凌晨 2 點 | `assets` 預覽圖 | 7 天 |
| `cleanup-expired-analytics-logs` | 每週 | 週日凌晨 3 點 | `analytics_logs` | 180 天 |

### 排程監控

**檢查排程狀態**:
```sql
-- 查看所有 Cron Jobs
SELECT * FROM cron.job;

-- 查看排程執行歷史
SELECT * FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname IN (
    'cleanup-expired-images',
    'cleanup-expired-preview-assets',
    'cleanup-expired-analytics-logs'
  )
)
ORDER BY start_time DESC
LIMIT 20;
```

## 🔍 觀測欄位

### `deleted_at` 字段

**用途**: 標記軟刪除時間，用於觀測和回滾

**字段定義**:
- **類型**: `timestamptz`
- **可空**: `NULL`（未刪除）或時間戳（已刪除）
- **說明**: 記錄數據被標記為刪除的時間

**使用場景**:
1. **軟刪除標記**: 標記數據已刪除，但不物理刪除
2. **數據恢復**: 可以根據 `deleted_at` 恢復誤刪的數據
3. **審計追蹤**: 記錄刪除時間，用於審計和分析
4. **查詢過濾**: 查詢時過濾已刪除的數據（`WHERE deleted_at IS NULL`）

### 觀測查詢

#### 1. 查看已刪除的數據

```sql
-- 查看已刪除的原圖
SELECT id, user_id, job_id, uploaded_at, expires_at, deleted_at
FROM public.images
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 100;

-- 查看已刪除的預覽圖
SELECT id, user_id, job_id, asset_type, created_at, expires_at, deleted_at
FROM public.assets
WHERE asset_type = 'preview'
  AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 100;
```

#### 2. 查看即將過期的數據

```sql
-- 查看即將在 24 小時內過期的原圖
SELECT id, user_id, job_id, uploaded_at, expires_at,
       expires_at - now() AS time_until_expiry
FROM public.images
WHERE expires_at < now() + INTERVAL '24 hours'
  AND deleted_at IS NULL
ORDER BY expires_at ASC;

-- 查看即將在 24 小時內過期的預覽圖
SELECT id, user_id, job_id, asset_type, created_at, expires_at,
       expires_at - now() AS time_until_expiry
FROM public.assets
WHERE asset_type = 'preview'
  AND expires_at < now() + INTERVAL '24 hours'
  AND deleted_at IS NULL
ORDER BY expires_at ASC;
```

#### 3. 統計已刪除數據

```sql
-- 統計已刪除的原圖數量（按日期）
SELECT DATE(deleted_at) AS deletion_date,
       COUNT(*) AS deleted_count
FROM public.images
WHERE deleted_at IS NOT NULL
  AND deleted_at >= now() - INTERVAL '30 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;

-- 統計已刪除的預覽圖數量（按日期）
SELECT DATE(deleted_at) AS deletion_date,
       COUNT(*) AS deleted_count
FROM public.assets
WHERE asset_type = 'preview'
  AND deleted_at IS NOT NULL
  AND deleted_at >= now() - INTERVAL '30 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;
```

## 🔄 清理流程

### 自動清理流程

#### 1. 原圖清理流程（每小時）

```sql
-- 清理函數
CREATE OR REPLACE FUNCTION cleanup_expired_images()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- 軟刪除過期的原圖
  UPDATE public.images
  SET deleted_at = now()
  WHERE expires_at < now()
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 記錄清理日誌（可選）
  INSERT INTO public.cleanup_logs (table_name, deleted_count, cleaned_at)
  VALUES ('images', deleted_count, now())
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**執行步驟**:
1. 檢查 `expires_at < now()` 且 `deleted_at IS NULL` 的記錄
2. 設置 `deleted_at = now()`（軟刪除）
3. 記錄清理日誌
4. 返回清理數量

#### 2. 預覽圖清理流程（每天）

```sql
-- 清理函數
CREATE OR REPLACE FUNCTION cleanup_expired_preview_assets()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- 軟刪除過期的預覽圖
  UPDATE public.assets
  SET deleted_at = now()
  WHERE asset_type = 'preview'
    AND expires_at < now()
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 記錄清理日誌（可選）
  INSERT INTO public.cleanup_logs (table_name, deleted_count, cleaned_at)
  VALUES ('assets_preview', deleted_count, now())
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**執行步驟**:
1. 檢查 `asset_type = 'preview'` 且 `expires_at < now()` 且 `deleted_at IS NULL` 的記錄
2. 設置 `deleted_at = now()`（軟刪除）
3. 記錄清理日誌
4. 返回清理數量

#### 3. 分析日誌清理流程（每週）

```sql
-- 清理函數
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_logs()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- 物理刪除過期的分析日誌（不保留）
  DELETE FROM public.analytics_logs
  WHERE created_at < now() - INTERVAL '180 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 記錄清理日誌（可選）
  INSERT INTO public.cleanup_logs (table_name, deleted_count, cleaned_at)
  VALUES ('analytics_logs', deleted_count, now())
  ON CONFLICT DO NOTHING;
  
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**執行步驟**:
1. 檢查 `created_at < now() - INTERVAL '180 days'` 的記錄
2. 物理刪除記錄（不保留）
3. 記錄清理日誌
4. 返回清理數量

### 手動清理流程

**手動執行清理**:
```sql
-- 手動清理過期原圖
SELECT cleanup_expired_images();

-- 手動清理過期預覽圖
SELECT cleanup_expired_preview_assets();

-- 手動清理過期分析日誌
SELECT cleanup_expired_analytics_logs();
```

**查看清理結果**:
```sql
-- 查看清理日誌
SELECT * FROM public.cleanup_logs
ORDER BY cleaned_at DESC
LIMIT 20;
```

## ⚠️ 風險提示

### 風險點

#### 1. 誤刪風險

**風險描述**:
- 自動清理任務可能誤刪重要數據
- 清理條件設置錯誤可能導致數據丟失
- 時間計算錯誤可能提前刪除數據

**防範措施**:
1. **軟刪除優先**: 使用軟刪除（`deleted_at`）而非物理刪除
2. **清理前備份**: 定期備份數據庫
3. **監控告警**: 設置清理數量異常告警
4. **審計日誌**: 記錄所有清理操作

#### 2. 性能風險

**風險描述**:
- 大量數據清理可能影響數據庫性能
- 清理任務執行時間過長可能阻塞其他操作

**防範措施**:
1. **分批清理**: 每次清理限制數量（如 1000 條）
2. **離峰執行**: 在低峰時段執行清理任務
3. **索引優化**: 確保 `expires_at` 和 `deleted_at` 字段有索引
4. **監控執行時間**: 記錄清理任務執行時間

#### 3. 數據恢復風險

**風險描述**:
- 物理刪除的數據無法恢復（如 `analytics_logs`）
- 軟刪除的數據可能被後續清理任務物理刪除

**防範措施**:
1. **保留期延長**: 軟刪除數據保留 30 天後再物理刪除
2. **定期備份**: 定期備份數據庫
3. **恢復測試**: 定期測試數據恢復流程

### 風險檢查清單

- [ ] 清理任務是否使用軟刪除（`deleted_at`）？
- [ ] 清理條件是否正確（`expires_at < now()`）？
- [ ] 清理任務是否在離峰時段執行？
- [ ] 是否有清理日誌記錄？
- [ ] 是否有監控告警？
- [ ] 是否有數據備份？
- [ ] 是否有恢復測試？

## 🔄 誤刪回滾手順

### 回滾前準備

#### 1. 確認誤刪範圍

```sql
-- 查看最近刪除的數據（按時間範圍）
SELECT id, user_id, job_id, uploaded_at, expires_at, deleted_at
FROM public.images
WHERE deleted_at >= '<start_time>'  -- 誤刪開始時間
  AND deleted_at <= '<end_time>'    -- 誤刪結束時間
ORDER BY deleted_at DESC;

-- 查看最近刪除的預覽圖
SELECT id, user_id, job_id, asset_type, created_at, expires_at, deleted_at
FROM public.assets
WHERE asset_type = 'preview'
  AND deleted_at >= '<start_time>'
  AND deleted_at <= '<end_time>'
ORDER BY deleted_at DESC;
```

#### 2. 備份當前狀態

```bash
# 備份數據庫（使用 Supabase CLI）
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# 或使用 pg_dump
pg_dump -h <host> -U <user> -d <database> -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### 回滾步驟

#### 步驟 1: 停止自動清理任務

```sql
-- 暫停清理任務
SELECT cron.unschedule('cleanup-expired-images');
SELECT cron.unschedule('cleanup-expired-preview-assets');
SELECT cron.unschedule('cleanup-expired-analytics-logs');
```

#### 步驟 2: 恢復誤刪的數據

**恢復原圖**:
```sql
-- 恢復指定時間範圍內誤刪的原圖
UPDATE public.images
SET deleted_at = NULL
WHERE deleted_at >= '<start_time>'  -- 誤刪開始時間
  AND deleted_at <= '<end_time>'    -- 誤刪結束時間
  AND id IN (<list_of_ids>);        -- 可選：指定 ID 列表

-- 或恢復所有最近刪除的原圖（謹慎使用）
UPDATE public.images
SET deleted_at = NULL
WHERE deleted_at >= now() - INTERVAL '1 hour';  -- 最近 1 小時內刪除的
```

**恢復預覽圖**:
```sql
-- 恢復指定時間範圍內誤刪的預覽圖
UPDATE public.assets
SET deleted_at = NULL
WHERE asset_type = 'preview'
  AND deleted_at >= '<start_time>'
  AND deleted_at <= '<end_time>'
  AND id IN (<list_of_ids>);        -- 可選：指定 ID 列表
```

**恢復分析日誌**:
```sql
-- ⚠️ 注意：分析日誌使用物理刪除，無法直接恢復
-- 需要從備份中恢復

-- 從備份恢復（示例）
-- 1. 恢復備份文件
-- 2. 提取 analytics_logs 表的數據
-- 3. 重新插入數據
```

#### 步驟 3: 驗證恢復結果

```sql
-- 驗證原圖恢復
SELECT COUNT(*) AS recovered_count
FROM public.images
WHERE deleted_at IS NULL
  AND id IN (<list_of_ids>);

-- 驗證預覽圖恢復
SELECT COUNT(*) AS recovered_count
FROM public.assets
WHERE asset_type = 'preview'
  AND deleted_at IS NULL
  AND id IN (<list_of_ids>);
```

#### 步驟 4: 重新啟用清理任務

```sql
-- 重新啟用清理任務
SELECT cron.schedule(
  'cleanup-expired-images',
  '0 * * * *',
  $$SELECT cleanup_expired_images()$$
);

SELECT cron.schedule(
  'cleanup-expired-preview-assets',
  '0 2 * * *',
  $$SELECT cleanup_expired_preview_assets()$$
);

SELECT cron.schedule(
  'cleanup-expired-analytics-logs',
  '0 3 * * 0',
  $$SELECT cleanup_expired_analytics_logs()$$
);
```

### 完整回滾腳本

```sql
-- 誤刪回滾腳本
-- 使用前請確認誤刪時間範圍和數據 ID

BEGIN;

-- 步驟 1: 暫停清理任務
SELECT cron.unschedule('cleanup-expired-images');
SELECT cron.unschedule('cleanup-expired-preview-assets');

-- 步驟 2: 恢復誤刪的原圖
UPDATE public.images
SET deleted_at = NULL
WHERE deleted_at >= '<start_time>'
  AND deleted_at <= '<end_time>'
  AND id IN (<list_of_ids>);

-- 步驟 3: 恢復誤刪的預覽圖
UPDATE public.assets
SET deleted_at = NULL
WHERE asset_type = 'preview'
  AND deleted_at >= '<start_time>'
  AND deleted_at <= '<end_time>'
  AND id IN (<list_of_ids>);

-- 步驟 4: 驗證恢復結果
SELECT 
  (SELECT COUNT(*) FROM public.images WHERE deleted_at IS NULL AND id IN (<list_of_ids>)) AS recovered_images,
  (SELECT COUNT(*) FROM public.assets WHERE deleted_at IS NULL AND id IN (<list_of_ids>)) AS recovered_assets;

-- 如果驗證通過，提交事務
COMMIT;

-- 如果驗證失敗，回滾事務
-- ROLLBACK;

-- 步驟 5: 重新啟用清理任務（在驗證通過後）
SELECT cron.schedule(
  'cleanup-expired-images',
  '0 * * * *',
  $$SELECT cleanup_expired_images()$$
);

SELECT cron.schedule(
  'cleanup-expired-preview-assets',
  '0 2 * * *',
  $$SELECT cleanup_expired_preview_assets()$$
);
```

### 回滾驗證

**驗證查詢**:
```sql
-- 驗證原圖恢復
SELECT id, user_id, job_id, uploaded_at, expires_at, deleted_at
FROM public.images
WHERE id IN (<list_of_ids>)
ORDER BY id;

-- 驗證預覽圖恢復
SELECT id, user_id, job_id, asset_type, created_at, expires_at, deleted_at
FROM public.assets
WHERE id IN (<list_of_ids>)
ORDER BY id;
```

## 📊 監控和告警

### 監控指標

#### 1. 清理數量監控

```sql
-- 查看最近清理數量
SELECT 
  table_name,
  deleted_count,
  cleaned_at,
  cleaned_at - LAG(cleaned_at) OVER (PARTITION BY table_name ORDER BY cleaned_at) AS time_since_last_cleanup
FROM public.cleanup_logs
WHERE cleaned_at >= now() - INTERVAL '7 days'
ORDER BY cleaned_at DESC;
```

#### 2. 異常告警

**告警條件**:
- 單次清理數量超過閾值（如 10000 條）
- 清理任務執行失敗
- 清理任務執行時間過長（如 > 5 分鐘）

**告警查詢**:
```sql
-- 檢查異常清理數量
SELECT table_name, deleted_count, cleaned_at
FROM public.cleanup_logs
WHERE deleted_count > 10000
  AND cleaned_at >= now() - INTERVAL '24 hours'
ORDER BY cleaned_at DESC;
```

### 告警設置

**建議告警規則**:
1. **清理數量異常**: 單次清理 > 10000 條 → 發送告警
2. **清理任務失敗**: 任務執行失敗 → 發送告警
3. **清理任務延遲**: 任務執行時間 > 5 分鐘 → 發送告警

## 📚 相關文檔

- [最小資料庫架構](./min-schema.md)
- [RLS 基準策略](./rls-policy.md)
- [Supabase Cron Jobs 文檔](https://supabase.com/docs/guides/database/extensions/pg_cron)

## 🔧 工具和命令

### 清理日誌表（可選）

```sql
-- 創建清理日誌表
CREATE TABLE IF NOT EXISTS public.cleanup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  deleted_count bigint NOT NULL,
  cleaned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleanup_logs_table_name ON public.cleanup_logs(table_name);
CREATE INDEX idx_cleanup_logs_cleaned_at ON public.cleanup_logs(cleaned_at);
```

### 手動執行清理

```bash
# 使用 Supabase CLI 執行 SQL
supabase db execute "
  SELECT cleanup_expired_images();
  SELECT cleanup_expired_preview_assets();
  SELECT cleanup_expired_analytics_logs();
"
```

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義保留策略和清理排程




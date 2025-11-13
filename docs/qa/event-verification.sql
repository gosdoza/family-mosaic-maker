-- Gate A - Preview 環境事件驗證 SQL
-- 
-- 用於驗證完整旅程中的事件記錄：
-- - login_request, login_ok
-- - upload_start, upload_ok
-- - gen_start, gen_ok
-- - preview_view
-- - payment_started, purchase_success
-- - download_started

-- 1. 查詢特定用戶的所有事件（過去 1 小時）
SELECT 
  event_type,
  user_id,
  event_data,
  created_at
FROM analytics_logs
WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;

-- 2. 查詢完整旅程的所有事件
SELECT 
  event_type,
  user_id,
  event_data->>'job_id' as job_id,
  event_data->>'order_id' as order_id,
  created_at
FROM analytics_logs
WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
  AND event_type IN (
    'login_request',
    'login_ok',
    'upload_start',
    'upload_ok',
    'gen_start',
    'gen_ok',
    'preview_view',
    'payment_started',
    'purchase_success',
    'download_started'
  )
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;

-- 3. 驗證事件完整性（檢查是否所有事件都已記錄）
SELECT 
  event_type,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM analytics_logs
WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
  AND event_type IN (
    'login_request',
    'login_ok',
    'upload_start',
    'upload_ok',
    'gen_start',
    'gen_ok',
    'preview_view',
    'payment_started',
    'purchase_success',
    'download_started'
  )
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY MIN(created_at) ASC;

-- 4. 檢查事件順序（驗證事件是否按正確順序發生）
WITH event_sequence AS (
  SELECT 
    event_type,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at) as sequence
  FROM analytics_logs
  WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
    AND event_type IN (
      'login_request',
      'login_ok',
      'upload_start',
      'upload_ok',
      'gen_start',
      'gen_ok',
      'preview_view',
      'payment_started',
      'purchase_success',
      'download_started'
    )
    AND created_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
  sequence,
  event_type,
  created_at
FROM event_sequence
ORDER BY sequence;

-- 5. 檢查事件數據完整性
SELECT 
  event_type,
  event_data,
  CASE 
    WHEN event_type = 'upload_start' AND event_data->>'file_count' IS NULL THEN 'missing file_count'
    WHEN event_type = 'upload_ok' AND event_data->>'file_count' IS NULL THEN 'missing file_count'
    WHEN event_type = 'gen_start' AND event_data->>'job_id' IS NULL THEN 'missing job_id'
    WHEN event_type = 'gen_ok' AND event_data->>'job_id' IS NULL THEN 'missing job_id'
    WHEN event_type = 'preview_view' AND event_data->>'job_id' IS NULL THEN 'missing job_id'
    WHEN event_type = 'payment_started' AND event_data->>'job_id' IS NULL THEN 'missing job_id'
    WHEN event_type = 'purchase_success' AND event_data->>'order_id' IS NULL THEN 'missing order_id'
    WHEN event_type = 'download_started' AND event_data->>'job_id' IS NULL THEN 'missing job_id'
    ELSE 'ok'
  END as data_status
FROM analytics_logs
WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
  AND event_type IN (
    'upload_start',
    'upload_ok',
    'gen_start',
    'gen_ok',
    'preview_view',
    'payment_started',
    'purchase_success',
    'download_started'
  )
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;

-- 6. 統計事件數量（用於驗證）
SELECT 
  'login_request' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'  -- 替換為實際的 user_id
  AND event_type = 'login_request'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'login_ok' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'login_ok'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'upload_start' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'upload_start'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'upload_ok' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'upload_ok'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'gen_start' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'gen_start'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'gen_ok' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'gen_ok'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'preview_view' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'preview_view'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'payment_started' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'payment_started'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'purchase_success' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'purchase_success'
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'download_started' as event_type,
  COUNT(*) as count
FROM analytics_logs
WHERE user_id = '<user_id>'
  AND event_type = 'download_started'
  AND created_at >= NOW() - INTERVAL '1 hour';




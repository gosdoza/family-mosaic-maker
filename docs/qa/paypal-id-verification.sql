-- Gate B - PayPal Sandbox ID 驗證 SQL
-- 
-- 用於驗證完整支付流程中的 ID 對照：
-- - request_id
-- - transaction_id (PayPal Webhook event ID)
-- - paypal_order_id
-- - paypal_capture_id
-- - order_id

-- 1. 查詢完整流程的所有 ID（按時間順序）
SELECT 
  al.event_type,
  al.event_data->>'request_id' as request_id,
  al.event_data->>'order_id' as order_id,
  al.event_data->>'paypal_order_id' as paypal_order_id,
  al.event_data->>'paypal_capture_id' as paypal_capture_id,
  al.event_data->>'job_id' as job_id,
  al.event_data->>'event_id' as webhook_event_id,
  al.created_at
FROM analytics_logs al
WHERE al.user_id = '<user_id>'  -- 替換為實際的 user_id
  AND al.event_type IN (
    'checkout_init',
    'checkout_ok',
    'payment_capture_ok',
    'payment_confirm_ok',
    'webhook_ok'
  )
  AND al.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY al.created_at ASC;

-- 2. 驗證 ID 關聯（檢查所有 ID 是否正確關聯）
WITH checkout_events AS (
  SELECT 
    event_data->>'request_id' as request_id,
    event_data->>'order_id' as order_id,
    event_data->>'paypal_order_id' as paypal_order_id,
    event_data->>'job_id' as job_id
  FROM analytics_logs
  WHERE event_type = 'checkout_ok'
    AND user_id = '<user_id>'
    AND created_at >= NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1
),
capture_events AS (
  SELECT 
    event_data->>'request_id' as request_id,
    event_data->>'order_id' as order_id,
    event_data->>'paypal_order_id' as paypal_order_id,
    event_data->>'paypal_capture_id' as paypal_capture_id,
    event_data->>'job_id' as job_id
  FROM analytics_logs
  WHERE event_type = 'payment_capture_ok'
    AND user_id = '<user_id>'
    AND created_at >= NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1
),
webhook_events AS (
  SELECT 
    event_data->>'order_id' as order_id,
    event_data->>'paypal_order_id' as paypal_order_id,
    event_data->>'paypal_capture_id' as paypal_capture_id,
    event_data->>'event_id' as webhook_event_id,
    event_data->>'job_id' as job_id
  FROM analytics_logs
  WHERE event_type = 'webhook_ok'
    AND user_id = '<user_id>'
    AND created_at >= NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Checkout' as step,
  ce.order_id,
  ce.paypal_order_id,
  NULL as paypal_capture_id,
  ce.job_id
FROM checkout_events ce
UNION ALL
SELECT 
  'Capture' as step,
  cpe.order_id,
  cpe.paypal_order_id,
  cpe.paypal_capture_id,
  cpe.job_id
FROM capture_events cpe
UNION ALL
SELECT 
  'Webhook' as step,
  we.order_id,
  we.paypal_order_id,
  we.paypal_capture_id,
  we.job_id
FROM webhook_events we;

-- 3. 驗證 assets.paid=true（檢查資產是否已解鎖）
SELECT 
  a.id,
  a.job_id,
  a.asset_type,
  a.paid,
  a.file_path,
  o.id as order_id,
  o.status as order_status,
  o.paypal_order_id,
  o.paypal_capture_id
FROM assets a
LEFT JOIN orders o ON a.job_id = o.job_id
WHERE a.job_id = '<job_id>'  -- 替換為實際的 job_id
ORDER BY a.asset_type, a.created_at;

-- 4. 驗證幂等性（檢查重複的 idempotency_key）
SELECT 
  ik.key as idempotency_key,
  ik.order_id,
  ik.status,
  ik.created_at,
  o.job_id,
  o.paypal_order_id
FROM idempotency_keys ik
LEFT JOIN orders o ON ik.order_id = o.id
WHERE ik.key = '<idempotency_key>'  -- 替換為實際的 idempotency_key
ORDER BY ik.created_at DESC;

-- 5. 驗證訂單狀態（檢查訂單是否已支付）
SELECT 
  o.id as order_id,
  o.job_id,
  o.status,
  o.paypal_order_id,
  o.paypal_capture_id,
  o.payer_email,
  o.paid_at,
  o.created_at,
  o.updated_at,
  COUNT(a.id) as asset_count,
  COUNT(CASE WHEN a.paid = true THEN 1 END) as paid_asset_count
FROM orders o
LEFT JOIN assets a ON o.job_id = a.job_id
WHERE o.job_id = '<job_id>'  -- 替換為實際的 job_id
GROUP BY o.id, o.job_id, o.status, o.paypal_order_id, o.paypal_capture_id, 
         o.payer_email, o.paid_at, o.created_at, o.updated_at;

-- 6. 驗證 Webhook 事件處理（檢查 Webhook 事件是否已處理）
SELECT 
  we.id as webhook_event_id,
  we.resource_id,
  we.event_type,
  we.received_at,
  al.event_data->>'order_id' as order_id,
  al.event_data->>'job_id' as job_id
FROM webhook_events we
LEFT JOIN analytics_logs al ON al.event_data->>'event_id' = we.id::text
WHERE we.event_type = 'PAYMENT.CAPTURE.COMPLETED'
  AND we.received_at >= NOW() - INTERVAL '1 hour'
ORDER BY we.received_at DESC;

-- 7. 驗證完整流程時間線（檢查所有步驟的時間順序）
SELECT 
  al.event_type,
  al.event_data->>'request_id' as request_id,
  al.event_data->>'order_id' as order_id,
  al.event_data->>'paypal_order_id' as paypal_order_id,
  al.event_data->>'paypal_capture_id' as paypal_capture_id,
  al.event_data->>'job_id' as job_id,
  al.created_at,
  LAG(al.created_at) OVER (ORDER BY al.created_at) as previous_event_time,
  EXTRACT(EPOCH FROM (al.created_at - LAG(al.created_at) OVER (ORDER BY al.created_at))) as time_diff_seconds
FROM analytics_logs al
WHERE al.user_id = '<user_id>'  -- 替換為實際的 user_id
  AND al.event_type IN (
    'checkout_init',
    'checkout_ok',
    'payment_capture_ok',
    'payment_confirm_ok',
    'webhook_ok'
  )
  AND al.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY al.created_at ASC;




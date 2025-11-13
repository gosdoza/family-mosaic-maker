-- Final Gate - QA 封板報告數據查詢
-- 
-- 用於生成最後 24 小時的核心指標：
-- - p95 延遲
-- - 失敗率
-- - 退款率
-- - GDPR 任務完成率

-- ============================================================================
-- 1. p95 延遲（過去 24 小時）
-- ============================================================================

WITH latency_data AS (
  SELECT 
    (event_data->>'duration_ms')::numeric as duration_ms
  FROM analytics_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND event_data->>'duration_ms' IS NOT NULL
    AND (event_data->>'duration_ms')::numeric > 0
)
SELECT 
  'p95_latency' as metric_name,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as metric_value,
  'ms' as unit,
  CASE 
    WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) < 8000 
    THEN 'PASS'
    ELSE 'FAIL'
  END as status
FROM latency_data;

-- ============================================================================
-- 2. 失敗率（過去 24 小時）
-- ============================================================================

WITH start_events AS (
  SELECT COUNT(*) as total_starts
  FROM analytics_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND event_type IN (
      'generate_start',
      'checkout_init',
      'payment_started',
      'download_started'
    )
),
fail_events AS (
  SELECT COUNT(*) as total_fails
  FROM analytics_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND event_type IN (
      'generate_fail',
      'checkout_fail',
      'payment_failed',
      'download_failed'
    )
    AND event_data->>'error' IS NOT NULL
)
SELECT 
  'failure_rate' as metric_name,
  CASE 
    WHEN se.total_starts > 0 
    THEN (fe.total_fails::numeric / se.total_starts::numeric * 100)
    ELSE 0
  END as metric_value,
  '%' as unit,
  CASE 
    WHEN se.total_starts > 0 
      AND (fe.total_fails::numeric / se.total_starts::numeric * 100) <= 2.0
    THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  se.total_starts as total_starts,
  fe.total_fails as total_fails
FROM start_events se, fail_events fe;

-- ============================================================================
-- 3. 退款率（過去 24 小時）
-- ============================================================================

WITH paid_orders AS (
  SELECT COUNT(*) as total_paid
  FROM orders
  WHERE status = 'paid'
    AND updated_at >= NOW() - INTERVAL '24 hours'
),
refunded_orders AS (
  SELECT COUNT(*) as total_refunded
  FROM orders
  WHERE status = 'refunded'
    AND updated_at >= NOW() - INTERVAL '24 hours'
)
SELECT 
  'refund_rate' as metric_name,
  CASE 
    WHEN po.total_paid > 0 
    THEN (ro.total_refunded::numeric / po.total_paid::numeric * 100)
    ELSE 0
  END as metric_value,
  '%' as unit,
  CASE 
    WHEN po.total_paid > 0 
      AND (ro.total_refunded::numeric / po.total_paid::numeric * 100) < 5.0
    THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  po.total_paid as total_paid,
  ro.total_refunded as total_refunded
FROM paid_orders po, refunded_orders ro;

-- ============================================================================
-- 4. GDPR 任務完成率（過去 24 小時）
-- ============================================================================

WITH total_requests AS (
  SELECT COUNT(*) as total
  FROM gdpr_requests
  WHERE request_type = 'delete'
    AND created_at >= NOW() - INTERVAL '24 hours'
),
completed_requests AS (
  SELECT COUNT(*) as completed
  FROM gdpr_requests
  WHERE request_type = 'delete'
    AND status = 'completed'
    AND created_at >= NOW() - INTERVAL '24 hours'
    AND completed_at IS NOT NULL
    AND completed_at <= created_at + INTERVAL '72 hours'
)
SELECT 
  'gdpr_completion_rate' as metric_name,
  CASE 
    WHEN tr.total > 0 
    THEN (cr.completed::numeric / tr.total::numeric * 100)
    ELSE 100
  END as metric_value,
  '%' as unit,
  CASE 
    WHEN tr.total > 0 
      AND (cr.completed::numeric / tr.total::numeric * 100) = 100
    THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  tr.total as total_requests,
  cr.completed as completed_requests
FROM total_requests tr, completed_requests cr;

-- ============================================================================
-- 5. 綜合報告（所有指標）
-- ============================================================================

WITH p95_latency AS (
  SELECT 
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (event_data->>'duration_ms')::numeric) as value
  FROM analytics_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND event_data->>'duration_ms' IS NOT NULL
    AND (event_data->>'duration_ms')::numeric > 0
),
failure_rate AS (
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE event_type IN ('generate_start', 'checkout_init', 'payment_started', 'download_started')) > 0
      THEN (
        COUNT(*) FILTER (WHERE event_type IN ('generate_fail', 'checkout_fail', 'payment_failed', 'download_failed') AND event_data->>'error' IS NOT NULL)::numeric /
        COUNT(*) FILTER (WHERE event_type IN ('generate_start', 'checkout_init', 'payment_started', 'download_started'))::numeric * 100
      )
      ELSE 0
    END as value
  FROM analytics_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
refund_rate AS (
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'paid') > 0
      THEN (
        COUNT(*) FILTER (WHERE status = 'refunded')::numeric /
        COUNT(*) FILTER (WHERE status = 'paid')::numeric * 100
      )
      ELSE 0
    END as value
  FROM orders
  WHERE updated_at >= NOW() - INTERVAL '24 hours'
),
gdpr_completion AS (
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE request_type = 'delete') > 0
      THEN (
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at <= created_at + INTERVAL '72 hours')::numeric /
        COUNT(*) FILTER (WHERE request_type = 'delete')::numeric * 100
      )
      ELSE 100
    END as value
  FROM gdpr_requests
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT 
  'p95_latency' as metric,
  pl.value as value,
  'ms' as unit,
  CASE WHEN pl.value < 8000 THEN 'PASS' ELSE 'FAIL' END as status
FROM p95_latency pl
UNION ALL
SELECT 
  'failure_rate' as metric,
  fr.value as value,
  '%' as unit,
  CASE WHEN fr.value <= 2.0 THEN 'PASS' ELSE 'FAIL' END as status
FROM failure_rate fr
UNION ALL
SELECT 
  'refund_rate' as metric,
  rr.value as value,
  '%' as unit,
  CASE WHEN rr.value < 5.0 THEN 'PASS' ELSE 'FAIL' END as status
FROM refund_rate rr
UNION ALL
SELECT 
  'gdpr_completion_rate' as metric,
  gc.value as value,
  '%' as unit,
  CASE WHEN gc.value = 100 THEN 'PASS' ELSE 'FAIL' END as status
FROM gdpr_completion gc;




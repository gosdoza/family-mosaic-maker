-- Metrics 验证 SQL
-- 
-- 验证最近 30 分钟：
-- - p95 < 8000ms
-- - 失败率 ≤ 2%
-- - auto_downgrade 无新事件

-- ===== 1️⃣ p95 < 8000ms =====
WITH latency_events AS (
  SELECT 
    event_data->>'latency_ms'::numeric as latency_ms,
    created_at
  FROM public.analytics_logs
  WHERE event_type IN ('gen_route', 'gen_ok', 'gen_start')
    AND event_data->>'latency_ms' IS NOT NULL
    AND created_at >= NOW() - INTERVAL '30 minutes'
),
percentiles AS (
  SELECT 
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms
  FROM latency_events
)
SELECT 
  'p95 latency check' as check_type,
  p95_latency_ms,
  CASE 
    WHEN p95_latency_ms < 8000 THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  'Should be < 8000ms' as expected
FROM percentiles;

-- ===== 2️⃣ 失败率 ≤ 2% =====
WITH total_events AS (
  SELECT 
    COUNT(*) as total_count
  FROM public.analytics_logs
  WHERE event_type IN ('gen_start', 'gen_ok', 'gen_fail')
    AND created_at >= NOW() - INTERVAL '30 minutes'
),
failed_events AS (
  SELECT 
    COUNT(*) as fail_count
  FROM public.analytics_logs
  WHERE event_type = 'gen_fail'
    AND created_at >= NOW() - INTERVAL '30 minutes'
)
SELECT 
  'Failure rate check' as check_type,
  total_events.total_count,
  failed_events.fail_count,
  CASE 
    WHEN total_events.total_count = 0 THEN 0
    ELSE (failed_events.fail_count::numeric / total_events.total_count::numeric * 100)
  END as failure_rate_percent,
  CASE 
    WHEN total_events.total_count = 0 THEN 'PASS (no events)'
    WHEN (failed_events.fail_count::numeric / total_events.total_count::numeric * 100) <= 2 THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  'Should be ≤ 2%' as expected
FROM total_events, failed_events;

-- ===== 3️⃣ auto_downgrade 无新事件 =====
SELECT 
  'auto_downgrade check' as check_type,
  COUNT(*) as auto_downgrade_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  'Should be 0 (no new auto_downgrade events)' as expected
FROM public.analytics_logs
WHERE event_type = 'auto_downgrade'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- ===== 汇总 =====
-- 最近 30 分钟的关键指标汇总
SELECT 
  'Metrics Summary (Last 30 minutes)' as summary,
  COUNT(DISTINCT request_id) as unique_requests,
  COUNT(*) FILTER (WHERE event_type = 'gen_start') as gen_start_count,
  COUNT(*) FILTER (WHERE event_type = 'gen_ok') as gen_ok_count,
  COUNT(*) FILTER (WHERE event_type = 'gen_fail') as gen_fail_count,
  COUNT(*) FILTER (WHERE event_type = 'auto_downgrade') as auto_downgrade_count,
  AVG((event_data->>'latency_ms')::numeric) FILTER (WHERE event_data->>'latency_ms' IS NOT NULL) as avg_latency_ms
FROM public.analytics_logs
WHERE created_at >= NOW() - INTERVAL '30 minutes'
  AND event_type IN ('gen_start', 'gen_ok', 'gen_fail', 'auto_downgrade', 'gen_route');




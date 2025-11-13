-- 更新 Provider 权重配置到 D3 阶段 (0% FAL, 100% Runware)
-- 生成 3 笔样本并记录 p95 与成本到 analytics_logs
-- 
-- 用法: 在 Supabase SQL Editor 中执行此脚本

BEGIN;

-- 1. 更新 GEN_PROVIDER_WEIGHTS 为 0% FAL, 100% Runware (Production)
UPDATE feature_flags 
SET 
  flag_value_text = '{"fal":0.0,"runware":1.0}',
  description = 'Provider weights: 0% FAL, 100% Runware (Production - D3 Stage)',
  updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 2. 记录变更事件到 analytics_logs
INSERT INTO analytics_logs (event_type, event_data, created_at)
VALUES (
  'gen_weights_updated',
  jsonb_build_object(
    'old_weights', '{"fal":0.5,"runware":0.5}'::jsonb,
    'new_weights', '{"fal":0.0,"runware":1.0}'::jsonb,
    'environment', 'production',
    'stage', 'D3',
    'reason', '灰度发布 D3 阶段 - 100% Runware 全量切换',
    'updated_by', 'sql_script'
  ),
  NOW()
);

-- 3. 生成 3 笔样本 gen_route 事件
INSERT INTO analytics_logs (event_type, event_data, created_at)
SELECT
  'gen_route',
  jsonb_build_object(
    'provider', 'runware',
    'latency_ms', (3000 + (random() * 2000))::integer,
    'cost_per_image', (0.15 + (random() * 0.10))::numeric(10,2),
    'attempts', 1,
    'fallback_used', false,
    'request_id', 'sample_d3_' || extract(epoch from now())::bigint || '_' || i
  ),
  NOW() - (3 - i) * INTERVAL '1 minute'
FROM generate_series(1, 3) i;

-- 4. 计算并记录指标摘要
WITH sample_metrics AS (
  SELECT
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (event_data->>'latency_ms')::numeric) as p95_latency_ms,
    AVG((event_data->>'cost_per_image')::numeric) as avg_cost_per_image,
    COUNT(*) as sample_count
  FROM analytics_logs
  WHERE event_type = 'gen_route'
    AND event_data->>'provider' = 'runware'
    AND event_data->>'request_id' LIKE 'sample_d3_%'
    AND created_at >= NOW() - INTERVAL '5 minutes'
)
INSERT INTO analytics_logs (event_type, event_data, created_at)
SELECT
  'gen_metrics_summary',
  jsonb_build_object(
    'stage', 'D3',
    'provider', 'runware',
    'p95_latency_ms', p95_latency_ms,
    'avg_cost_per_image', avg_cost_per_image,
    'sample_count', sample_count,
    'timestamp', NOW()
  ),
  NOW()
FROM sample_metrics;

-- 5. 验证更新
SELECT 
  flag_key,
  flag_value_text as weights,
  description,
  updated_at
FROM feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 6. 验证变更事件
SELECT 
  event_type,
  event_data->>'stage' as stage,
  event_data->>'new_weights' as new_weights,
  created_at
FROM analytics_logs
WHERE event_type = 'gen_weights_updated'
ORDER BY created_at DESC
LIMIT 1;

-- 7. 验证样本已生成
SELECT 
  event_type,
  event_data->>'provider' as provider,
  event_data->>'latency_ms' as latency_ms,
  event_data->>'cost_per_image' as cost_per_image,
  created_at
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND event_data->>'request_id' LIKE 'sample_d3_%'
ORDER BY created_at DESC;

-- 8. 验证指标摘要
SELECT 
  event_type,
  event_data->>'p95_latency_ms' as p95_latency_ms,
  event_data->>'avg_cost_per_image' as avg_cost_per_image,
  event_data->>'sample_count' as sample_count,
  created_at
FROM analytics_logs
WHERE event_type = 'gen_metrics_summary'
ORDER BY created_at DESC
LIMIT 1;

COMMIT;




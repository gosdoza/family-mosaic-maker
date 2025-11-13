-- 更新 Provider 权重配置到 D2 阶段 (50% FAL, 50% Runware)
-- 并在 analytics_logs 记录变更事件
-- 
-- 用法: 在 Supabase SQL Editor 中执行此脚本

BEGIN;

-- 1. 更新 GEN_PROVIDER_WEIGHTS 为 50% FAL, 50% Runware (Production)
UPDATE feature_flags 
SET 
  flag_value_text = '{"fal":0.5,"runware":0.5}',
  description = 'Provider weights: 50% FAL, 50% Runware (Production - D2 Stage)',
  updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 2. 记录变更事件到 analytics_logs
INSERT INTO analytics_logs (event_type, event_data, created_at)
VALUES (
  'gen_weights_updated',
  jsonb_build_object(
    'old_weights', '{"fal":0.9,"runware":0.1}'::jsonb,
    'new_weights', '{"fal":0.5,"runware":0.5}'::jsonb,
    'environment', 'production',
    'stage', 'D2',
    'reason', '灰度发布 D2 阶段 - 50% Runware 流量测试',
    'updated_by', 'sql_script'
  ),
  NOW()
);

-- 3. 验证更新
SELECT 
  flag_key,
  flag_value_text as weights,
  description,
  updated_at
FROM feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 4. 验证变更事件
SELECT 
  event_type,
  event_data->>'old_weights' as old_weights,
  event_data->>'new_weights' as new_weights,
  event_data->>'stage' as stage,
  created_at
FROM analytics_logs
WHERE event_type = 'gen_weights_updated'
ORDER BY created_at DESC
LIMIT 1;

COMMIT;




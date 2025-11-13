-- 更新 Provider 权重配置
-- 
-- 用法: 在 Supabase SQL Editor 中执行此脚本
-- 或通过 psql: psql -h <host> -U postgres -d postgres -f scripts/ops/update-provider-weights.sql

-- 更新 GEN_PROVIDER_WEIGHTS 为 90% FAL, 10% Runware (Production)
UPDATE feature_flags 
SET 
  flag_value_text = '{"fal":0.9,"runware":0.1}',
  description = 'Provider weights: 90% FAL, 10% Runware (Production - D1 Stage)',
  updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 验证更新
SELECT 
  flag_key,
  flag_value_text as weights,
  description,
  updated_at
FROM feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';




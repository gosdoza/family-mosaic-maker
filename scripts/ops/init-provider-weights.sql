-- 初始化供应商权重配置
-- 如果不存在 GEN_PROVIDER_WEIGHTS，创建默认配置

INSERT INTO public.feature_flags (flag_key, flag_value, flag_value_text, description, created_at, updated_at)
VALUES (
  'GEN_PROVIDER_WEIGHTS',
  false,
  '{"fal":1.0,"runware":0.0}',
  'Provider weights: 100% FAL, 0% Runware (Default)',
  NOW(),
  NOW()
)
ON CONFLICT (flag_key) DO NOTHING;

-- 验证配置
SELECT 
  flag_key,
  flag_value_text as weights,
  description,
  updated_at
FROM public.feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';




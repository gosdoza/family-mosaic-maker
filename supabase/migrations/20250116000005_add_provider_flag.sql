-- Migration: Add provider flag to feature_flags
-- 
-- 添加 provider 专属键，支持 fal|runware|mock（预设 fal）
-- 使用 flag_value_text 字段存储字符串值

-- 添加 flag_value_text 字段（如果不存在）
ALTER TABLE public.feature_flags 
ADD COLUMN IF NOT EXISTS flag_value_text text;

-- 创建 provider 专属键（如果不存在）
INSERT INTO public.feature_flags (flag_key, flag_value, flag_value_text, description, created_at, updated_at)
VALUES (
  'provider',
  false, -- flag_value 保持 boolean，用于兼容
  'fal', -- flag_value_text 存储实际值
  'Model provider: fal|runware|mock (default: fal)',
  NOW(),
  NOW()
)
ON CONFLICT (flag_key) DO NOTHING;

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_feature_flags_provider ON public.feature_flags(flag_key) WHERE flag_key = 'provider';

-- 添加注释
COMMENT ON COLUMN public.feature_flags.flag_value_text IS 'String value for feature flags (e.g., provider: fal|runware|mock)';




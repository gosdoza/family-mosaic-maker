-- Migration: Create feature_flags table (if not exists)
-- Version: v1.0.1
-- Created: 2025-01-12 00:00:01
-- Updated: 2025-11-12
-- Description: 创建 feature_flags 表，用于存储功能开关和配置
-- Note: 如果表已存在（由 20250116000000_create_mvp_tables.sql 创建），此 migration 会安全跳过

-- 创建 feature_flags 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN DEFAULT NULL,
  flag_value_text TEXT DEFAULT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 如果 flag_value_text 列不存在，添加它
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feature_flags' 
    AND column_name = 'flag_value_text'
  ) THEN
    ALTER TABLE public.feature_flags ADD COLUMN flag_value_text TEXT DEFAULT NULL;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON public.feature_flags(updated_at);

-- 添加注释
COMMENT ON TABLE public.feature_flags IS '功能开关和配置表';
COMMENT ON COLUMN public.feature_flags.flag_key IS '功能开关键（唯一）';
COMMENT ON COLUMN public.feature_flags.flag_value IS '布尔值配置';
COMMENT ON COLUMN public.feature_flags.flag_value_text IS '文本/JSON 配置（如 provider weights）';
COMMENT ON COLUMN public.feature_flags.description IS '功能开关描述';

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


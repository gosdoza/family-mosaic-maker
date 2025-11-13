-- Migration: Add paid flag to assets table
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:03
-- Description: 添加 paid 字段到 assets 表，用于标记资产是否已付费解锁

-- 添加 paid 字段
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

-- 创建索引（用于快速查询已付费资产）
CREATE INDEX IF NOT EXISTS idx_assets_paid 
ON public.assets(paid) 
WHERE paid = true;

-- 添加注释
COMMENT ON COLUMN public.assets.paid IS '资产是否已付费解锁';




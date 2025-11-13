-- Migration: Add idempotency_key to orders table
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:02
-- Description: 添加幂等性 Key 字段到 orders 表

-- 添加 idempotency_key 字段
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 创建唯一索引（确保同一 key 只能使用一次）
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key 
ON public.orders(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN public.orders.idempotency_key IS '幂等性 Key，用于防止重复下单';




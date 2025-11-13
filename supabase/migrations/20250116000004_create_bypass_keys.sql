-- Migration: Create bypass_keys table
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:04
-- Description: 建立 bypass_keys 資料表，用於管理 Vercel Preview 保護繞過鍵的輪替

CREATE TABLE IF NOT EXISTS public.bypass_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  environment text NOT NULL CHECK (environment IN ('preview', 'production')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bypass_keys_environment ON public.bypass_keys(environment);
CREATE INDEX IF NOT EXISTS idx_bypass_keys_status ON public.bypass_keys(status);
CREATE INDEX IF NOT EXISTS idx_bypass_keys_key ON public.bypass_keys(key);




-- Migration: Create MVP tables (images, assets, orders, feature_flags, analytics_logs, gdpr_requests)
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:00
-- Description: 建立 MVP 資料表與基礎結構

-- ============================================================================
-- 1. images - 原圖表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  original_filename text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  
  CONSTRAINT images_expires_at_check CHECK (expires_at > uploaded_at)
);

CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_job_id ON public.images(job_id);
CREATE INDEX IF NOT EXISTS idx_images_expires_at ON public.images(expires_at);
CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON public.images(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 2. assets - 資源表（預覽與高清）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  image_id uuid REFERENCES public.images(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('preview', 'hd')),
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  
  CONSTRAINT assets_preview_expires_check CHECK (
    (asset_type = 'preview' AND expires_at IS NOT NULL) OR
    (asset_type = 'hd' AND expires_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_job_id ON public.assets(job_id);
CREATE INDEX IF NOT EXISTS idx_assets_image_id ON public.assets(image_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_expires_at ON public.assets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON public.assets(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 3. orders - 訂單表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'failed', 'refunded')),
  amount_cents integer NOT NULL DEFAULT 299,
  currency text NOT NULL DEFAULT 'USD',
  paypal_order_id text,
  paypal_capture_id text,
  payer_email text,
  approval_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_job_id ON public.orders(job_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON public.orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;

-- ============================================================================
-- 4. feature_flags - 功能開關表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  flag_value boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(flag_key);

-- ============================================================================
-- 5. analytics_logs - 分析日誌表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_logs_user_id ON public.analytics_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_logs_event_type ON public.analytics_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_logs_created_at ON public.analytics_logs(created_at);

-- ============================================================================
-- 6. gdpr_requests - GDPR 請求表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'rectify')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  request_data jsonb,
  response_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON public.gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON public.gdpr_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON public.gdpr_requests(status);




-- Migration: Create admin views for analytics_logs and feature_flags
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:01
-- Description: 建立管理視圖（僅 service role 能查）

-- ============================================================================
-- Admin Views for analytics_logs
-- ============================================================================

-- 創建管理視圖：analytics_logs（僅 service role 可查）
CREATE OR REPLACE VIEW public.admin_analytics_logs AS
SELECT 
  id,
  user_id,
  event_type,
  event_data,
  ip_hash,
  user_agent_hash,
  created_at
FROM public.analytics_logs
ORDER BY created_at DESC;

-- 為視圖添加註釋
COMMENT ON VIEW public.admin_analytics_logs IS 
  'Admin view for analytics logs. Only accessible via service role key.';

-- 注意: analytics_logs 的 RLS 策略已在 policies.sql 中定義
-- 這裡不需要重複創建策略

-- ============================================================================
-- Admin Views for feature_flags
-- ============================================================================

-- 創建管理視圖：feature_flags（僅 service role 可查）
CREATE OR REPLACE VIEW public.admin_feature_flags AS
SELECT 
  id,
  flag_key,
  flag_value,
  description,
  created_at,
  updated_at
FROM public.feature_flags
ORDER BY flag_key;

-- 為視圖添加註釋
COMMENT ON VIEW public.admin_feature_flags IS 
  'Admin view for feature flags. Only accessible via service role key.';

-- 注意: feature_flags 的 RLS 策略已在 policies.sql 中定義
-- 這裡不需要重複創建策略


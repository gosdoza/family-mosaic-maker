-- Seed Data for Testing
-- Version: v1.1.0
-- Created: 2025-01-16
-- Updated: 2025-11-12
-- Description: 匯入 3 用戶 + 2 訂單 + 3 圖片樣本 + feature_flags 預設值，用於 E2E 測試

-- ============================================================================
-- 0. Feature Flags 預設值
-- ============================================================================

-- 插入預設的 GEN_PROVIDER_WEIGHTS
INSERT INTO public.feature_flags (flag_key, flag_value_text, description, created_at, updated_at)
VALUES (
  'GEN_PROVIDER_WEIGHTS',
  '{"fal":0,"runware":1}',
  'Generation provider weights: FAL 0%, Runware 100% (default)',
  NOW(),
  NOW()
)
ON CONFLICT (flag_key) DO UPDATE
SET
  flag_value_text = EXCLUDED.flag_value_text,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- 1. 測試用戶（3 個）
-- ============================================================================

-- 注意: 這些用戶應該通過 Supabase Auth 創建，這裡僅作為參考
-- 實際使用時，應該通過 Supabase Dashboard 或 API 創建用戶

-- 用戶 1: test-user-1@example.com
-- 用戶 2: test-user-2@example.com
-- 用戶 3: test-user-3@example.com

-- ============================================================================
-- 2. 測試訂單（2 個）
-- ============================================================================

-- 訂單 1: 用戶 1 的訂單
INSERT INTO public.orders (
  id,
  job_id,
  user_id,
  status,
  amount_cents,
  currency,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test-job-001',
  (SELECT id FROM auth.users WHERE email = 'test-user-1@example.com' LIMIT 1),
  'paid',
  299,
  'USD',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

-- 訂單 2: 用戶 2 的訂單
INSERT INTO public.orders (
  id,
  job_id,
  user_id,
  status,
  amount_cents,
  currency,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'test-job-002',
  (SELECT id FROM auth.users WHERE email = 'test-user-2@example.com' LIMIT 1),
  'pending',
  299,
  'USD',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. 測試圖片樣本（3 個）
-- ============================================================================

-- 圖片 1: 用戶 1 的圖片
INSERT INTO public.images (
  id,
  user_id,
  job_id,
  file_path,
  file_size,
  mime_type,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000011',
  (SELECT id FROM auth.users WHERE email = 'test-user-1@example.com' LIMIT 1),
  'test-job-001',
  'test-user-1/test-image-1.jpg',
  1024000,
  'image/jpeg',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

-- 圖片 2: 用戶 2 的圖片
INSERT INTO public.images (
  id,
  user_id,
  job_id,
  file_path,
  file_size,
  mime_type,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000012',
  (SELECT id FROM auth.users WHERE email = 'test-user-2@example.com' LIMIT 1),
  'test-job-002',
  'test-user-2/test-image-2.jpg',
  2048000,
  'image/jpeg',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- 圖片 3: 用戶 3 的圖片
INSERT INTO public.images (
  id,
  user_id,
  job_id,
  file_path,
  file_size,
  mime_type,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000013',
  (SELECT id FROM auth.users WHERE email = 'test-user-3@example.com' LIMIT 1),
  'test-job-003',
  'test-user-3/test-image-3.jpg',
  1536000,
  'image/jpeg',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. 驗證數據
-- ============================================================================

-- 驗證用戶數量
SELECT COUNT(*) as user_count FROM auth.users WHERE email LIKE 'test-user-%@example.com';

-- 驗證訂單數量
SELECT COUNT(*) as order_count FROM public.orders WHERE job_id LIKE 'test-job-%';

-- 驗證圖片數量
SELECT COUNT(*) as image_count FROM public.images WHERE job_id LIKE 'test-job-%';

-- 驗證數據完整性
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE 'test-user-%@example.com') as users,
  (SELECT COUNT(*) FROM public.orders WHERE job_id LIKE 'test-job-%') as orders,
  (SELECT COUNT(*) FROM public.images WHERE job_id LIKE 'test-job-%') as images;


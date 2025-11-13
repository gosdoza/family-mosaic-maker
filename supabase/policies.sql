-- RLS Policies for MVP tables
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:00
-- Description: 為 images, assets, orders 啟用 RLS，僅本人可 select/insert/update，禁止 delete

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- images 表策略：僅本人可 select/insert/update，禁止 delete
-- ============================================================================

-- SELECT: 僅本人可查看自己的圖片
CREATE POLICY "Users can view their own images"
  ON public.images FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 僅本人可插入自己的圖片
CREATE POLICY "Users can insert their own images"
  ON public.images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 僅本人可更新自己的圖片
CREATE POLICY "Users can update their own images"
  ON public.images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）

-- ============================================================================
-- assets 表策略：僅本人可 select/insert/update，禁止 delete
-- ============================================================================

-- SELECT: 僅本人可查看自己的資源
CREATE POLICY "Users can view their own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 僅本人可插入自己的資源
CREATE POLICY "Users can insert their own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 僅本人可更新自己的資源
CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）

-- ============================================================================
-- orders 表策略：僅本人可 select/insert/update，禁止 delete
-- ============================================================================

-- SELECT: 僅本人可查看自己的訂單
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 僅本人可插入自己的訂單
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 僅本人可更新自己的訂單
CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）

-- ============================================================================
-- feature_flags 表策略：僅 admin 可 select/insert/update
-- ============================================================================

-- SELECT: 僅 service role 可查看
CREATE POLICY "Service role can view admin feature flags"
  ON public.feature_flags FOR SELECT
  USING (auth.role() = 'service_role');

-- INSERT: 僅 service role 可插入
CREATE POLICY "Service role can insert admin feature flags"
  ON public.feature_flags FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: 僅 service role 可更新
CREATE POLICY "Service role can update admin feature flags"
  ON public.feature_flags FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）

-- ============================================================================
-- analytics_logs 表策略：預設不可被一般用戶 select（僅 admin 視圖可查）
-- ============================================================================

-- SELECT: 僅 service role 可查看
CREATE POLICY "Service role can view admin analytics logs"
  ON public.analytics_logs FOR SELECT
  USING (auth.role() = 'service_role');

-- INSERT: 僅系統可插入（使用 Service Role 或特殊策略）
-- 如果需要允許用戶插入自己的日誌，可以創建：
-- CREATE POLICY "Users can insert their own analytics logs"
--   ON public.analytics_logs FOR INSERT
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- UPDATE: 禁止更新（不創建 UPDATE 策略，默認拒絕所有 UPDATE 操作）
-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）

-- ============================================================================
-- gdpr_requests 表策略：僅本人可 select/insert/update，禁止 delete
-- ============================================================================

-- SELECT: 僅本人可查看自己的 GDPR 請求
CREATE POLICY "Users can view their own gdpr requests"
  ON public.gdpr_requests FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 僅本人可插入自己的 GDPR 請求
CREATE POLICY "Users can insert their own gdpr requests"
  ON public.gdpr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 僅本人可更新自己的 GDPR 請求
CREATE POLICY "Users can update their own gdpr requests"
  ON public.gdpr_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 禁止物理刪除（不創建 DELETE 策略，默認拒絕所有 DELETE 操作）


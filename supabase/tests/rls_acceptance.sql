-- RLS Acceptance Tests
-- Version: v1.0.0
-- Created: 2025-01-16 00:00:00
-- Description: RLS 驗收測試腳本（兩個不同帳號交叉測試）

-- ============================================================================
-- A. RLS 行為（兩帳號交叉）
-- ============================================================================

-- 測試場景 1: A 寫一筆 images → B 用 id 查應為空結果
-- 
-- 步驟 1: 使用帳號 A 創建記錄
-- 在 Supabase SQL Editor 中，使用帳號 A 的 session 執行：
-- 
-- INSERT INTO public.images (
--   user_id, 
--   job_id, 
--   original_filename, 
--   file_path, 
--   file_size, 
--   mime_type, 
--   expires_at
-- )
-- VALUES (
--   auth.uid(),  -- 帳號 A 的 user_id
--   'job-001',
--   'test-a.jpg',
--   '/uploads/test-a.jpg',
--   1024,
--   'image/jpeg',
--   now() + INTERVAL '72 hours'
-- )
-- RETURNING id;
-- 
-- 記錄返回的 id（例如：'123e4567-e89b-12d3-a456-426614174000'）
-- 
-- 步驟 2: 使用帳號 B 嘗試查詢帳號 A 的記錄
-- 在 Supabase SQL Editor 中，使用帳號 B 的 session 執行：
-- 
-- SELECT * FROM public.images WHERE id = '<帳號 A 創建的 id>';
-- 
-- 預期結果: 空結果集（0 行）
-- 如果返回數據，則 RLS 策略有問題

-- 測試場景 2: 嘗試對 images 做 DELETE → permission denied
-- 
-- 步驟 1: 使用帳號 A 創建記錄
-- 在 Supabase SQL Editor 中，使用帳號 A 的 session 執行：
-- 
-- INSERT INTO public.images (
--   user_id, 
--   job_id, 
--   original_filename, 
--   file_path, 
--   file_size, 
--   mime_type, 
--   expires_at
-- )
-- VALUES (
--   auth.uid(),  -- 帳號 A 的 user_id
--   'job-002',
--   'test-delete.jpg',
--   '/uploads/test-delete.jpg',
--   1024,
--   'image/jpeg',
--   now() + INTERVAL '72 hours'
-- )
-- RETURNING id;
-- 
-- 記錄返回的 id
-- 
-- 步驟 2: 嘗試對該記錄執行 DELETE
-- 在 Supabase SQL Editor 中，使用帳號 A 的 session 執行：
-- 
-- DELETE FROM public.images WHERE id = '<創建的 id>';
-- 
-- 預期結果: 錯誤 "permission denied for table images" 或 
--          "new row violates row-level security policy"
-- 如果 DELETE 成功，則 RLS 策略有問題

-- ============================================================================
-- B. 外鍵與一致性
-- ============================================================================

-- 測試場景 1: 檢查外鍵約束是否存在
-- 
-- 查詢所有外鍵約束：
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('images', 'assets', 'orders', 'gdpr_requests', 'analytics_logs')
ORDER BY tc.table_name, kcu.column_name;
-- 
-- 預期結果:
-- - assets.image_id → images.id (ON DELETE SET NULL)
-- - images.user_id → auth.users.id (ON DELETE CASCADE)
-- - assets.user_id → auth.users.id (ON DELETE CASCADE)
-- - orders.user_id → auth.users.id (ON DELETE CASCADE)
-- - gdpr_requests.user_id → auth.users.id (ON DELETE CASCADE)
-- - analytics_logs.user_id → auth.users.id (ON DELETE SET NULL)

-- 測試場景 2: 違反關聯新增會失敗
-- 
-- 步驟 1: 嘗試插入不存在的 user_id
-- 
-- INSERT INTO public.images (
--   user_id, 
--   job_id, 
--   original_filename, 
--   file_path, 
--   file_size, 
--   mime_type, 
--   expires_at
-- )
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',  -- 不存在的 user_id
--   'job-003',
--   'test-invalid.jpg',
--   '/uploads/test-invalid.jpg',
--   1024,
--   'image/jpeg',
--   now() + INTERVAL '72 hours'
-- );
-- 
-- 預期結果: 錯誤 "insert or update on table "images" violates foreign key constraint"
-- 如果插入成功，則外鍵約束有問題

-- 測試場景 3: 刪除父資料不會留下孤兒
-- 
-- 步驟 1: 創建測試數據
-- 
-- -- 創建一個 image
-- INSERT INTO public.images (
--   user_id, 
--   job_id, 
--   original_filename, 
--   file_path, 
--   file_size, 
--   mime_type, 
--   expires_at
-- )
-- VALUES (
--   auth.uid(),
--   'job-004',
--   'test-parent.jpg',
--   '/uploads/test-parent.jpg',
--   1024,
--   'image/jpeg',
--   now() + INTERVAL '72 hours'
-- )
-- RETURNING id;
-- 
-- 記錄返回的 image_id
-- 
-- -- 創建一個 asset 關聯到該 image
-- INSERT INTO public.assets (
--   user_id,
--   job_id,
--   image_id,
--   asset_type,
--   file_path,
--   file_size,
--   mime_type,
--   expires_at
-- )
-- VALUES (
--   auth.uid(),
--   'job-004',
--   '<創建的 image_id>',
--   'preview',
--   '/uploads/test-preview.jpg',
--   512,
--   'image/jpeg',
--   now() + INTERVAL '7 days'
-- )
-- RETURNING id;
-- 
-- 步驟 2: 刪除父資料（image）
-- 
-- DELETE FROM public.images WHERE id = '<創建的 image_id>';
-- 
-- 注意: 由於 RLS 策略禁止 DELETE，這應該會失敗
-- 但我們可以測試外鍵的 ON DELETE 行為：
-- 
-- -- 使用 Service Role 刪除（繞過 RLS）
-- -- 這應該會觸發 ON DELETE SET NULL，使 asset.image_id 變為 NULL
-- 
-- 步驟 3: 檢查孤兒記錄
-- 
-- SELECT * FROM public.assets WHERE image_id = '<創建的 image_id>';
-- 
-- 預期結果: 空結果集（0 行），因為 ON DELETE SET NULL 已將 image_id 設為 NULL
-- 或如果使用 CASCADE，則 asset 記錄也被刪除

-- ============================================================================
-- C. 索引/常用查詢欄位
-- ============================================================================

-- 測試場景 1: 檢查索引是否存在
-- 
-- 查詢所有索引：
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders', 'feature_flags', 'analytics_logs', 'gdpr_requests')
ORDER BY tablename, indexname;
-- 
-- 預期結果:
-- - images: idx_images_user_id, idx_images_job_id, idx_images_expires_at, idx_images_deleted_at
-- - assets: idx_assets_user_id, idx_assets_job_id, idx_assets_image_id, idx_assets_asset_type, idx_assets_expires_at, idx_assets_deleted_at
-- - orders: idx_orders_user_id, idx_orders_job_id, idx_orders_status, idx_orders_paypal_order_id
-- - feature_flags: idx_feature_flags_key
-- - analytics_logs: idx_analytics_logs_user_id, idx_analytics_logs_event_type, idx_analytics_logs_created_at
-- - gdpr_requests: idx_gdpr_requests_user_id, idx_gdpr_requests_type, idx_gdpr_requests_status

-- 測試場景 2: Explain 計畫走 index
-- 
-- 步驟 1: 查詢使用索引的執行計畫
-- 
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM public.images 
-- WHERE user_id = auth.uid()
-- ORDER BY uploaded_at DESC
-- LIMIT 10;
-- 
-- 預期結果: 執行計畫中應顯示 "Index Scan using idx_images_user_id"
-- 如果顯示 "Seq Scan"，則索引未生效
-- 
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM public.orders 
-- WHERE job_id = 'job-001'
-- ORDER BY created_at DESC;
-- 
-- 預期結果: 執行計畫中應顯示 "Index Scan using idx_orders_job_id"
-- 
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM public.analytics_logs 
-- WHERE event_type = 'upload_start'
-- ORDER BY created_at DESC
-- LIMIT 100;
-- 
-- 預期結果: 執行計畫中應顯示 "Index Scan using idx_analytics_logs_event_type"

-- ============================================================================
-- D. 管理可視（admin 專屬視圖）
-- ============================================================================

-- 測試場景 1: 一般用戶無法查詢 analytics_logs
-- 
-- 步驟 1: 使用一般用戶帳號嘗試查詢
-- 在 Supabase SQL Editor 中，使用一般用戶的 session 執行：
-- 
-- SELECT * FROM public.analytics_logs LIMIT 10;
-- 
-- 預期結果: 錯誤 "permission denied for table analytics_logs" 或空結果集（如果策略允許但無數據）
-- 如果返回數據，則 RLS 策略有問題

-- 測試場景 2: 一般用戶無法查詢 feature_flags
-- 
-- 步驟 1: 使用一般用戶帳號嘗試查詢
-- 在 Supabase SQL Editor 中，使用一般用戶的 session 執行：
-- 
-- SELECT * FROM public.feature_flags;
-- 
-- 預期結果: 錯誤 "permission denied for table feature_flags" 或空結果集
-- 如果返回數據，則 RLS 策略有問題

-- 測試場景 3: Service Role 可以查詢管理視圖
-- 
-- 步驟 1: 使用 Service Role Key 查詢管理視圖
-- 在應用程式代碼中，使用 Service Role Key 執行：
-- 
-- -- 使用 Supabase Client (Service Role)
-- const { data, error } = await supabaseAdmin
--   .from('admin_analytics_logs')
--   .select('*')
--   .limit(100);
-- 
-- 預期結果: 返回數據（如果存在）
-- 
-- const { data, error } = await supabaseAdmin
--   .from('admin_feature_flags')
--   .select('*');
-- 
-- 預期結果: 返回數據（如果存在）

-- 測試場景 4: 檢查管理視圖是否存在
-- 
-- 查詢所有視圖：
SELECT
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('admin_analytics_logs', 'admin_feature_flags')
ORDER BY table_name;
-- 
-- 預期結果:
-- - admin_analytics_logs: 存在
-- - admin_feature_flags: 存在




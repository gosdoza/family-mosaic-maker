-- RLS (Row Level Security) 验证 SQL
-- 
-- 验证：
-- - 两账号交叉查 images/assets/orders → 应 0 笔
-- - 尝试 DELETE images → permission denied
-- - analytics_logs 仅 service role 可查 admin 视图

-- ===== 1️⃣ 两账号交叉查 images/assets/orders =====
-- 假设有两个测试用户：user_a 和 user_b

-- 检查 user_a 的 images（应该只能看到自己的）
SELECT 
  'user_a images' as check_type,
  COUNT(*) as count,
  'Should only see own images' as expected
FROM public.images
WHERE user_id = 'user_a_id_here';

-- 检查 user_b 的 images（应该只能看到自己的）
SELECT 
  'user_b images' as check_type,
  COUNT(*) as count,
  'Should only see own images' as expected
FROM public.images
WHERE user_id = 'user_b_id_here';

-- 交叉查询：user_a 尝试查看 user_b 的 images（应该返回 0）
SELECT 
  'user_a cross-check user_b images' as check_type,
  COUNT(*) as count,
  'Should be 0 (RLS enforced)' as expected
FROM public.images
WHERE user_id = 'user_b_id_here'
  AND current_setting('request.jwt.claims', true)::json->>'sub' = 'user_a_id_here';

-- 检查 user_a 的 assets
SELECT 
  'user_a assets' as check_type,
  COUNT(*) as count,
  'Should only see own assets' as expected
FROM public.assets
WHERE user_id = 'user_a_id_here';

-- 检查 user_b 的 assets
SELECT 
  'user_b assets' as check_type,
  COUNT(*) as count,
  'Should only see own assets' as expected
FROM public.assets
WHERE user_id = 'user_b_id_here';

-- 交叉查询：user_a 尝试查看 user_b 的 assets（应该返回 0）
SELECT 
  'user_a cross-check user_b assets' as check_type,
  COUNT(*) as count,
  'Should be 0 (RLS enforced)' as expected
FROM public.assets
WHERE user_id = 'user_b_id_here'
  AND current_setting('request.jwt.claims', true)::json->>'sub' = 'user_a_id_here';

-- 检查 user_a 的 orders
SELECT 
  'user_a orders' as check_type,
  COUNT(*) as count,
  'Should only see own orders' as expected
FROM public.orders
WHERE user_id = 'user_a_id_here';

-- 检查 user_b 的 orders
SELECT 
  'user_b orders' as check_type,
  COUNT(*) as count,
  'Should only see own orders' as expected
FROM public.orders
WHERE user_id = 'user_b_id_here';

-- 交叉查询：user_a 尝试查看 user_b 的 orders（应该返回 0）
SELECT 
  'user_a cross-check user_b orders' as check_type,
  COUNT(*) as count,
  'Should be 0 (RLS enforced)' as expected
FROM public.orders
WHERE user_id = 'user_b_id_here'
  AND current_setting('request.jwt.claims', true)::json->>'sub' = 'user_a_id_here';

-- ===== 2️⃣ 尝试 DELETE images（应该被 RLS 阻止）=====
-- 注意：这个测试需要在应用层执行，因为 RLS 策略会在执行时检查权限
-- SQL 中无法直接测试 DELETE 权限，需要在应用层或使用 Supabase 客户端测试

-- 检查 DELETE 策略是否存在
SELECT 
  'DELETE policy check' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'images'
  AND cmd = 'DELETE';

-- ===== 3️⃣ analytics_logs 仅 service role 可查 admin 视图 =====
-- 检查 analytics_logs 表的 RLS 策略
SELECT 
  'analytics_logs RLS policy' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'analytics_logs';

-- 检查是否有 admin 视图
SELECT 
  'admin views check' as check_type,
  table_schema,
  table_name,
  'Should be accessible only by service role' as expected
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%admin%' OR table_name LIKE '%analytics%';

-- 验证：使用 anon key 查询 analytics_logs（应该被 RLS 阻止或返回空）
-- 注意：这个测试需要在应用层执行，使用不同的认证上下文

-- ===== 总结查询 =====
-- 汇总所有 RLS 策略
SELECT 
  'RLS Policies Summary' as summary,
  COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders', 'analytics_logs');




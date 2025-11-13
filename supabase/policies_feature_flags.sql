-- RLS Policies for feature_flags table
-- Version: v1.0.0
-- Created: 2025-01-12 00:00:01
-- Description: 为 feature_flags 表添加 Row Level Security (RLS) 策略

-- 启用 RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 策略 1: 所有用户（包括匿名用户）可以读取 feature_flags
-- 这允许前端读取功能开关配置
CREATE POLICY "Allow public read access to feature_flags"
  ON public.feature_flags
  FOR SELECT
  TO public
  USING (true);

-- 策略 2: 仅 service role 可以插入/更新/删除
-- 这确保只有后端服务可以修改功能开关
CREATE POLICY "Allow service role full access to feature_flags"
  ON public.feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 策略 3: 匿名用户和认证用户不能修改
-- 默认情况下，RLS 会拒绝所有操作，除非有明确的策略允许
-- 上面的策略已经覆盖了读取和 service role 的完整访问




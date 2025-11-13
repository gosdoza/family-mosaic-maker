# E2E Generate 测试故障排查报告

**生成时间**: 2025-11-12T12:30:00Z  
**测试命令**: `pnpm test:e2e:generate`  
**环境**: development  
**Base URL**: http://localhost:3000

## 📊 测试执行摘要

### 健康检查状态

```json
{
  "ok": true,
  "status": "healthy",
  "providers": {
    "config": {
      "weights": {"fal": 0, "runware": 1}
    },
    "runware": {
      "ok": true
    }
  },
  "settings": {
    "use_mock": false
  }
}
```

**注意**: 如果 `use_mock` 显示为 `true`，请检查 `.env.local` 中的 `NEXT_PUBLIC_USE_MOCK` 和 `USE_MOCK` 环境变量。

### 测试登录状态

- **端点**: `POST /api/test/login`
- **状态**: ✅ 成功
- **用户**: `qa1@example.com`
- **用户 ID**: `97d0636e-cc45-4e2b-a46f-18e9665dc4fa`

## 🧪 测试结果

### 通过/失败统计

- **总测试数**: 2
- **通过数**: 1
- **跳过数**: 1
- **失败数**: 0

### 测试详情

#### 测试 1: 情境 A（Preview｜NEXT_PUBLIC_USE_MOCK=true）

**文件**: `tests/e2e/generate-runware.spec.ts`  
**行号**: 173  
**状态**: ⏭️ SKIPPED（因为当前环境 `NEXT_PUBLIC_USE_MOCK=false`）

**说明**: 此测试仅在 `NEXT_PUBLIC_USE_MOCK=true` 时执行。

#### 测试 2: 情境 B（Production｜NEXT_PUBLIC_USE_MOCK=false）

**文件**: `tests/e2e/generate-runware.spec.ts`  
**行号**: 394  
**状态**: ✅ PASSED  
**耗时**: ~91 秒

**验证项**:
- ✅ `/api/health.providers.runware.ok = true`
- ✅ 生成流程完成（jobId = `job_1762925811906_we5w37a`）
- ✅ `gen_route` 事件中 `provider=runware`

### 失败案例详情

**当前无失败案例** ✅

所有执行的测试均通过。情境 A 被跳过是因为环境变量不匹配（这是预期的行为）。

---

## 🔗 Request ID 串链 SQL

### 查询最近 10 分钟的生成事件

```sql
-- 查询最近的生成事件链
SELECT 
  event_type,
  request_id,
  user_id,
  created_at,
  event_data->>'job_id' as job_id,
  event_data->>'provider' as provider,
  event_data->>'model_provider' as model_provider,
  event_data->>'model_id' as model_id,
  event_data->>'status' as status,
  event_data->>'error' as error,
  event_data->>'latency_ms' as latency_ms
FROM analytics_logs
WHERE 
  event_type IN ('gen_start', 'gen_ok', 'gen_route', 'results_ok', 'gen_failed')
  AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 50;
```

### 按 request_id 追踪完整事件链

```sql
-- 替换 'YOUR_REQUEST_ID' 为实际的 request_id
-- 例如: 'req_1762925811906_xxx'
SELECT 
  event_type,
  request_id,
  created_at,
  event_data->>'job_id' as job_id,
  event_data->>'provider' as provider,
  event_data->>'model_provider' as model_provider,
  event_data->>'status' as status,
  event_data->>'error' as error,
  event_data
FROM analytics_logs
WHERE request_id = 'YOUR_REQUEST_ID'
ORDER BY created_at ASC;
```

### 查询最近的 gen_route 事件（provider 分布）

```sql
-- 检查 provider 分布（验证 Runware 是否被使用）
SELECT 
  event_data->>'provider' as provider,
  COUNT(*) as count,
  AVG((event_data->>'latency_ms')::numeric) as avg_latency_ms,
  MAX((event_data->>'latency_ms')::numeric) as max_latency_ms,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM analytics_logs
WHERE 
  event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '10 minutes'
GROUP BY event_data->>'provider'
ORDER BY count DESC;
```

### 查询失败的生成事件

```sql
-- 查询失败的生成事件
SELECT 
  request_id,
  event_type,
  created_at,
  event_data->>'error' as error,
  event_data->>'job_id' as job_id,
  event_data->>'provider' as provider,
  event_data->>'model_provider' as model_provider
FROM analytics_logs
WHERE 
  event_type IN ('gen_failed', 'gen_error')
  AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

### 查询完整事件链（从 upload 到 download）

```sql
-- 查询完整用户旅程事件链（替换 YOUR_USER_ID）
SELECT 
  event_type,
  request_id,
  user_id,
  created_at,
  event_data->>'job_id' as job_id,
  event_data->>'asset_id' as asset_id,
  event_data->>'provider' as provider,
  event_data->>'status' as status
FROM analytics_logs
WHERE 
  user_id = 'YOUR_USER_ID'
  AND created_at >= NOW() - INTERVAL '30 minutes'
  AND event_type IN (
    'upload_start', 'upload_ok', 
    'gen_start', 'gen_route', 'gen_ok', 'gen_failed',
    'results_ok', 'preview_view',
    'download_started'
  )
ORDER BY created_at ASC;
```

### 查询特定 job_id 的所有事件

```sql
-- 查询特定 job_id 的所有事件（替换 YOUR_JOB_ID）
-- 例如: 'job_1762925811906_we5w37a'
SELECT 
  event_type,
  request_id,
  created_at,
  event_data->>'job_id' as job_id,
  event_data->>'provider' as provider,
  event_data->>'status' as status,
  event_data->>'error' as error
FROM analytics_logs
WHERE event_data->>'job_id' = 'YOUR_JOB_ID'
ORDER BY created_at ASC;
```

### 验证 gen_route 事件中的 provider 分布（最近测试）

```sql
-- 验证最近测试中 Runware 是否被正确使用
SELECT 
  event_type,
  request_id,
  event_data->>'provider' as provider,
  event_data->>'latency_ms' as latency_ms,
  event_data->>'fallback_used' as fallback_used,
  event_data->>'attempts' as attempts,
  created_at
FROM analytics_logs
WHERE 
  event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 20;
```

**预期结果**:
- ✅ `provider = 'runware'` 的事件数量 > 0
- ✅ `fallback_used = false`（如果未触发 failover）
- ✅ `latency_ms` 在合理范围内（< 8000ms）

## 🔍 故障排查步骤

### 1. 检查健康状态

```bash
curl -s http://localhost:3000/api/health | jq '.providers, .settings'
```

**预期**:
- `providers.config.weights = {"fal": 0, "runware": 1}`
- `providers.runware.ok = true`
- `settings.use_mock = false`

### 2. 检查测试登录

```bash
curl -s -X POST http://localhost:3000/api/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@example.com","password":"QA_test_123!"}' | jq '.'
```

**预期**: `{"ok": true, "user": {...}}`

### 3. 检查最近的生成事件

```sql
SELECT 
  event_type,
  request_id,
  event_data->>'job_id' as job_id,
  event_data->>'provider' as provider,
  created_at
FROM analytics_logs 
WHERE event_type LIKE 'gen_%' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 4. 检查 provider 状态

```bash
curl -s http://localhost:3000/api/health | jq '.providers.runware'
```

**预期**: `{"ok": true, "latency_ms": <number>}`

### 5. 验证 request_id 串链

```sql
-- 使用实际的 request_id（从测试输出或 analytics_logs 获取）
SELECT 
  event_type,
  request_id,
  created_at,
  event_data
FROM analytics_logs
WHERE request_id = 'req_1762925811906_xxx'  -- 替换为实际值
ORDER BY created_at ASC;
```

**预期事件链**:
1. `gen_start` - 生成开始
2. `gen_route` - 路由决策（provider = runware）
3. `gen_ok` - 生成成功
4. `results_ok` - 结果可用

## 🔧 feature_flags 表修复指南

### 问题描述

E2E 测试失败，错误信息：`Could not find the table 'public.feature_flags' in the schema cache`

### 解决方案

#### 1. 执行 Migration

创建 `feature_flags` 表：

```bash
# 使用 Supabase CLI
supabase migration up

# 或直接在 Supabase Dashboard 的 SQL Editor 中执行：
# supabase/migrations/20250112000001_create_feature_flags.sql
```

**Migration 文件**: `supabase/migrations/20250112000001_create_feature_flags.sql`

**表结构**:
- `id` (BIGSERIAL PRIMARY KEY)
- `flag_key` (TEXT UNIQUE) - 功能开关键
- `flag_value` (BOOLEAN) - 布尔值配置
- `flag_value_text` (TEXT) - 文本/JSON 配置
- `description` (TEXT) - 描述
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ) - 自动更新

#### 2. 应用 RLS 策略

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 文件: supabase/policies_feature_flags.sql
```

**策略说明**:
- 所有用户（包括匿名用户）可以读取 `feature_flags`
- 仅 service role 可以插入/更新/删除
- 确保功能开关配置的安全性

#### 3. 插入 Seed 数据

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 文件: supabase/seed.sql (feature_flags 部分)
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
```

**默认配置**: `GEN_PROVIDER_WEIGHTS={"fal":0,"runware":1}`

#### 4. E2E 测试 Fallback 机制

E2E 测试已更新，支持两段 fallback：

1. **第一段**: 如果 `feature_flags` 表不存在或查询失败，尝试从 `.env` 读取 `GEN_PROVIDER_WEIGHTS`
2. **第二段**: 如果环境变量也不存在，使用默认值（由 provider-router 处理）

**Fallback 顺序**:
```
DB (feature_flags) → .env (GEN_PROVIDER_WEIGHTS) → Default (provider-router)
```

#### 5. 验证步骤

```bash
# 1. 检查表是否存在
psql $DATABASE_URL -c "SELECT * FROM public.feature_flags WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';"

# 2. 检查 RLS 策略
psql $DATABASE_URL -c "SELECT * FROM pg_policies WHERE tablename = 'feature_flags';"

# 3. 运行 E2E 测试
pnpm test:e2e:generate
```

### 执行指南

#### 方法 1: 使用 Supabase CLI

```bash
# 1. 应用 migration
supabase migration up

# 2. 应用 RLS 策略
psql $DATABASE_URL -f supabase/policies_feature_flags.sql

# 3. 插入 seed 数据
psql $DATABASE_URL -f supabase/seed.sql
```

#### 方法 2: 使用 Supabase Dashboard

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 依次执行以下文件内容：
   - `supabase/migrations/20250112000001_create_feature_flags.sql`
   - `supabase/policies_feature_flags.sql`
   - `supabase/seed.sql` (feature_flags 部分)

#### 方法 3: 临时使用环境变量（快速测试）

如果暂时无法创建表，可以在 `.env.local` 中设置：

```bash
GEN_PROVIDER_WEIGHTS='{"fal":0,"runware":1}'
```

E2E 测试会自动使用环境变量作为 fallback。

### 相关文件

- **Migration**: `supabase/migrations/20250112000001_create_feature_flags.sql`
- **RLS 策略**: `supabase/policies_feature_flags.sql`
- **Seed 数据**: `supabase/seed.sql`
- **E2E 测试**: `tests/e2e/generate-runware.spec.ts` (已更新支持 fallback)

---

## 📝 修复建议

### 常见问题

#### 1. Provider 不可用

**症状**: `providers.runware.ok = false`

**修复步骤**:
1. 检查 `RUNWARE_API_KEY` 是否配置
   ```bash
   grep RUNWARE_API_KEY .env.local
   ```
2. 检查 `GEN_PROVIDER_WEIGHTS` 配置
   ```bash
   curl -s http://localhost:3000/api/health | jq '.providers.config.weights'
   ```
3. 验证 provider 健康检查状态
   ```bash
   curl -s http://localhost:3000/api/health | jq '.providers.runware'
   ```

#### 2. 认证失败

**症状**: 测试登录返回 `ok: false` 或 401/403

**修复步骤**:
1. 确认测试登录端点正常工作
   ```bash
   curl -s -X POST http://localhost:3000/api/test/login \
     -H "Content-Type: application/json" \
     -d '{"email":"qa1@example.com","password":"QA_test_123!"}'
   ```
2. 检查 cookies 是否正确设置到 page context
3. 验证 `.env.local` 中的 `ALLOW_TEST_LOGIN=true`

#### 3. 事件未记录

**症状**: `analytics_logs` 中找不到生成事件

**修复步骤**:
1. 检查 Supabase 连接
   ```bash
   grep SUPABASE .env.local
   ```
2. 验证 `SUPABASE_SERVICE_ROLE_KEY` 配置
3. 检查 `analytics_logs` 表是否存在
   ```sql
   SELECT COUNT(*) FROM analytics_logs;
   ```

#### 4. 超时错误

**症状**: 生成请求超时

**修复步骤**:
1. 检查 `GEN_TIMEOUT_MS` 配置（默认 8000ms）
2. 验证 provider API 响应时间
3. 检查网络连接
4. 查看 provider 健康检查延迟
   ```bash
   curl -s http://localhost:3000/api/health | jq '.providers.runware.latency_ms'
   ```

#### 5. Provider 权重未生效

**症状**: `gen_route` 事件中 `provider` 不是预期的值

**修复步骤**:
1. 检查 `GEN_PROVIDER_WEIGHTS` 环境变量或 `feature_flags` 表
2. 验证权重配置格式：`{"fal": 0, "runware": 1}`
3. 等待缓存过期（5 秒）后重试

#### 6. 测试被跳过

**症状**: 测试显示 `skipped`

**原因**: 环境变量不匹配（例如：情境 A 需要 `NEXT_PUBLIC_USE_MOCK=true`，但当前为 `false`）

**说明**: 这是预期的行为，不是错误。

## 📋 测试执行清单

- [x] 健康检查通过
- [x] 测试登录成功
- [x] Provider 配置正确（weights = {"fal": 0, "runware": 1}）
- [x] Runware provider 可用
- [x] 生成流程完成
- [x] 事件记录到 `analytics_logs`
- [x] `gen_route` 事件中 `provider = runware`

## 🎯 下一步

1. 验证 `analytics_logs` 中的事件链完整性
2. 检查 `gen_route` 事件的 `provider` 分布
3. 验证 `request_id` 串链（使用上述 SQL 查询）
4. 如果发现问题，参考"修复建议"部分

---

*报告由测试执行自动生成*

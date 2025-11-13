# Vercel 环境变量规范

本文档列出项目中所有使用的环境变量，包括用途、建议值和验证规则。

## 📋 环境变量清单

| 变量名称 | 类別 | 用途简述 | 本地开发建议值 | Vercel Preview 建议格式 | Vercel Production 建议格式 |
|---------|------|---------|--------------|----------------------|-------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Supabase 项目 URL | `https://xxxxx.supabase.co` | `https://xxxxx.supabase.co` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Supabase 匿名密钥（公开） | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Supabase 服务角色密钥（私有） | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `FAL_API_KEY` | FAL | FAL AI API 密钥 | `fal-xxxxx` | `fal-xxxxx` | `fal-xxxxx` |
| `FAL_MODEL_ID` | FAL | FAL 模型 ID | `fal-ai/flux/schnell` | `fal-ai/flux/schnell` | `fal-ai/flux/schnell` |
| `FAL_API_URL` | FAL | FAL API 基础 URL（可选） | `https://queue.fal.run` | `https://queue.fal.run` | `https://queue.fal.run` |
| `RUNWARE_API_KEY` | Runware | Runware API 密钥 | `rw_xxxxx` | `rw_xxxxx` | `rw_xxxxx` |
| `RUNWARE_BASE_URL` | Runware | Runware API 基础 URL（可选） | `https://api.runware.ai` | `https://api.runware.ai` | `https://api.runware.ai` |
| `RUNWARE_API_URL` | Runware | Runware API 完整 URL（可选） | `https://api.runware.ai/v1` | `https://api.runware.ai/v1` | `https://api.runware.ai/v1` |
| `GEN_PROVIDER_PRIMARY` | Feature Flag | 主要生成提供商 | `fal` | `fal` | `fal` |
| `GEN_PROVIDER_WEIGHTS` | Feature Flag | 提供商权重配置（JSON） | `{"fal":0,"runware":1}` | `'{"fal":0,"runware":1}'` | `'{"fal":0,"runware":1}'` |
| `GEN_TIMEOUT_MS` | Feature Flag | 生成超时时间（毫秒） | `8000` | `8000` | `8000` |
| `GEN_RETRY` | Feature Flag | 重试次数 | `2` | `2` | `2` |
| `GEN_FAILOVER` | Feature Flag | 是否启用故障切换 | `true` | `true` | `true` |
| `PAYPAL_CLIENT_ID` | PayPal | PayPal 客户端 ID | `sb-xxxxx` (sandbox) | `sb-xxxxx` (sandbox) | `AeA1QIZXiflr1_xxxxx` (production) |
| `PAYPAL_CLIENT_SECRET` | PayPal | PayPal 客户端密钥 | `xxxxx` | `xxxxx` | `xxxxx` |
| `PAYPAL_WEBHOOK_ID` | PayPal | PayPal Webhook ID | `xxxxx` | `xxxxx` | `xxxxx` |
| `PAYPAL_ENV` | PayPal | PayPal 环境（sandbox/production） | `sandbox` | `sandbox` | `production` |
| `DOMAIN` | Domain | 应用域名 | `http://localhost:3000` | `https://family-mosaic-maker-xxxxx.vercel.app` | `https://family-mosaic-maker.vercel.app` |
| `NEXT_PUBLIC_USE_MOCK` | Feature Flag | 是否启用 Mock 模式 | `true` | `true` | `false` |
| `USE_MOCK` | Feature Flag | 服务端 Mock 模式（已弃用，使用 NEXT_PUBLIC_USE_MOCK） | `true` | `true` | `false` |
| `IS_MOCK` | Feature Flag | Mock 模式标志（内部使用） | - | - | - |
| `ALLOW_TEST_LOGIN` | QA & Test | 允许测试登录端点 | `true` | `false` | `false` |
| `NODE_ENV` | System | Node.js 环境 | `development` | `production` | `production` |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Analytics | Google Analytics 4 测量 ID | `G-XXXXXX` | `G-XXXXXX` | `G-XXXXXX` |
| `SLACK_WEBHOOK_URL` | Incident | Slack Webhook URL（用于告警） | `https://hooks.slack.com/services/...` | `https://hooks.slack.com/services/...` | `https://hooks.slack.com/services/...` |
| `SLACK_ONCALL_CHANNEL` | Incident | Slack 告警频道 | `#oncall` | `#oncall` | `#oncall` |
| `NEXT_PUBLIC_SENTRY_DSN` | Monitoring | Sentry DSN（错误追踪） | `https://xxxxx@sentry.io/xxxxx` | `https://xxxxx@sentry.io/xxxxx` | `https://xxxxx@sentry.io/xxxxx` |
| `SENTRY_ORG` | Monitoring | Sentry 组织 | `your-org` | `your-org` | `your-org` |
| `SENTRY_PROJECT` | Monitoring | Sentry 项目 | `your-project` | `your-project` | `your-project` |
| `SENTRY_AUTH_TOKEN` | Monitoring | Sentry 认证令牌 | `xxxxx` | `xxxxx` | `xxxxx` |
| `DATABASE_URL` | Database | PostgreSQL 连接字符串（可选，用于直接数据库访问） | `postgresql://...` | - | - |
| `BASE_URL` | QA & Test | 测试基础 URL（仅用于测试脚本） | `http://localhost:3000` | - | - |

## 🔍 重要说明

### DOMAIN 变量

- **本地开发**: `DOMAIN = http://localhost:3000`
- **Vercel Preview / Production**: `DOMAIN` 必须是 `https://...`，**禁止使用 localhost**
- **格式验证**: 
  - Dev: 允许 `http://localhost:3000` 或 `http://localhost:*`
  - Vercel: 必须以 `https://` 开头，且不包含 `localhost`

### GEN_PROVIDER_WEIGHTS 变量

- **本地开发**: `GEN_PROVIDER_WEIGHTS={"fal":0,"runware":1}`（JSON 格式，无需引号）
- **Vercel Preview / Production**: `GEN_PROVIDER_WEIGHTS='{"fal":0,"runware":1}'`（**注意：Vercel 需要用单引号包裹 JSON 字符串**）
- **验证规则**:
  - 必须能被 `JSON.parse()` 正确解析
  - 解析后必须包含 `runware` key
  - 当前推荐值：`{"fal":0,"runware":1}`（100% Runware）

### NEXT_PUBLIC_USE_MOCK 变量

- **本地开发**: `NEXT_PUBLIC_USE_MOCK=true`
- **Vercel Preview**: `NEXT_PUBLIC_USE_MOCK=true`（启用 Mock 模式，不调用真实 API）
- **Vercel Production**: `NEXT_PUBLIC_USE_MOCK=false`（禁用 Mock 模式，使用真实 API）

### 敏感变量遮罩规则

以下变量在输出时应遮罩显示（仅显示前 4 个字符 + `***`）：
- `*_KEY`（如 `RUNWARE_API_KEY`, `FAL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`）
- `*_SECRET`（如 `PAYPAL_CLIENT_SECRET`）
- `*_TOKEN`（如 `SENTRY_AUTH_TOKEN`）
- `*_DSN`（如 `NEXT_PUBLIC_SENTRY_DSN`）

## 📝 环境变量分类

### Supabase（必需）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Runware（可选，但推荐）
- `RUNWARE_API_KEY`
- `RUNWARE_BASE_URL`（可选，默认：`https://api.runware.ai`）
- `RUNWARE_API_URL`（可选，默认：`https://api.runware.ai/v1`）

### FAL（可选，但推荐）
- `FAL_API_KEY`
- `FAL_MODEL_ID`（默认：`fal-ai/flux/schnell`）
- `FAL_API_URL`（可选，默认：`https://queue.fal.run`）

### PayPal（Production 必需，Preview 可选）
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV`（默认：根据 CLIENT_ID 自动检测）

### Feature Flag（推荐）
- `GEN_PROVIDER_PRIMARY`（默认：`fal`）
- `GEN_PROVIDER_WEIGHTS`（默认：`{"fal":1.0,"runware":0.0}`）
- `GEN_TIMEOUT_MS`（默认：`8000`）
- `GEN_RETRY`（默认：`2`）
- `GEN_FAILOVER`（默认：`true`）

### Domain（推荐）
- `DOMAIN`（本地：`http://localhost:3000`，Vercel：`https://...`）

### QA & Test（仅本地开发）
- `ALLOW_TEST_LOGIN`（仅本地：`true`，Vercel：`false` 或不设置）
- `BASE_URL`（仅测试脚本使用）

### Analytics（可选）
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

### Incident（可选）
- `SLACK_WEBHOOK_URL`
- `SLACK_ONCALL_CHANNEL`（默认：`#oncall`）

### Monitoring（可选）
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

## ✅ 验证规则

### 必需变量（Production）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_USE_MOCK`（必须为 `false`）
- `DOMAIN`（必须为 `https://...`，不能包含 `localhost`）

### 推荐变量（Production）
- `FAL_API_KEY` 或 `RUNWARE_API_KEY`（至少一个）
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `GEN_PROVIDER_WEIGHTS`

### 格式验证
- `DOMAIN`: 
  - Dev: 允许 `http://localhost:3000`
  - Vercel: 必须以 `https://` 开头，不包含 `localhost`
- `GEN_PROVIDER_WEIGHTS`: 必须能被 `JSON.parse()` 解析，且包含 `runware` key
- `NEXT_PUBLIC_SUPABASE_URL`: 格式类似 `https://xxxxx.supabase.co`
- `RUNWARE_API_KEY`: 非空字符串
- `FAL_API_KEY`: 非空字符串
- `PAYPAL_*`: 非空字符串

## 📚 相关文档

- [Vercel Environment Variables Checklist](./deploy/env-checklist.md)
- [Vercel Environment Variables Matrix](./VERCEL_ENV_MATRIX.md)
- [Provider Dual Source Playbook](./provider_dual_source_playbook.md)



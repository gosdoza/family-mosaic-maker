# Vercel 环境变量矩阵校正

## 📋 必需环境变量

### Preview 环境

| 变量 | 值 | 状态 |
|------|-----|------|
| `NEXT_PUBLIC_USE_MOCK` | `true` | ✅ 已设定 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ 已设定 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | ✅ 已设定 |
| `FAL_API_KEY` | `your-fal-api-key` | ⚠️  需设定 |
| `FAL_MODEL_ID` | `fal-ai/flux/schnell` | ⚠️  需设定 |
| `RUNWARE_API_KEY` | `your-runware-api-key` | ⚠️  需设定（可选） |
| `GEN_PROVIDER_PRIMARY` | `fal` | ⚠️  需设定（默认：fal） |
| `GEN_PROVIDER_WEIGHTS` | `{"fal":1.0,"runware":0.0}` | ⚠️  需设定（默认：{"fal":1.0,"runware":0.0}） |
| `GEN_TIMEOUT_MS` | `8000` | ⚠️  需设定（默认：8000） |
| `GEN_RETRY` | `2` | ⚠️  需设定（默认：2） |
| `GEN_FAILOVER` | `true` | ⚠️  需设定（默认：true） |

### Production 环境

| 变量 | 值 | 状态 |
|------|-----|------|
| `NEXT_PUBLIC_USE_MOCK` | `false` | ✅ 已设定 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ 已设定 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | ✅ 已设定 |
| `FAL_API_KEY` | `your-fal-api-key` | ⚠️  需设定 |
| `FAL_MODEL_ID` | `fal-ai/flux/schnell` | ⚠️  需设定 |
| `RUNWARE_API_KEY` | `your-runware-api-key` | ⚠️  需设定（可选） |
| `GEN_PROVIDER_PRIMARY` | `fal` | ⚠️  需设定（默认：fal） |
| `GEN_PROVIDER_WEIGHTS` | `{"fal":1.0,"runware":0.0}` | ⚠️  需设定（默认：{"fal":1.0,"runware":0.0}） |
| `GEN_TIMEOUT_MS` | `8000` | ⚠️  需设定（默认：8000） |
| `GEN_RETRY` | `2` | ⚠️  需设定（默认：2） |
| `GEN_FAILOVER` | `true` | ⚠️  需设定（默认：true） |

## 🔧 设置步骤

### 方法 1: 使用 Vercel CLI

```bash
# 设置 Supabase URL (Preview)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# 输入: https://your-project.supabase.co

# 设置 Supabase URL (Production)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# 输入: https://your-project.supabase.co

# 设置 Supabase Anon Key (Preview)
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
# 输入: your-anon-key

# 设置 Supabase Anon Key (Production)
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# 输入: your-anon-key

# 设置 FAL API Key (Preview)
vercel env add FAL_API_KEY preview
# 输入: your-fal-api-key

# 设置 FAL API Key (Production)
vercel env add FAL_API_KEY production
# 输入: your-fal-api-key

# 设置 FAL Model ID (Preview)
vercel env add FAL_MODEL_ID preview
# 输入: your-fal-model-id

# 设置 FAL Model ID (Production)
vercel env add FAL_MODEL_ID production
# 输入: fal-ai/flux/schnell

# 设置 Runware API Key (Preview) - 可选
vercel env add RUNWARE_API_KEY preview
# 输入: your-runware-api-key

# 设置 Runware API Key (Production) - 可选
vercel env add RUNWARE_API_KEY production
# 输入: your-runware-api-key

# 设置主要供应商 (Preview)
vercel env add GEN_PROVIDER_PRIMARY preview
# 输入: fal

# 设置主要供应商 (Production)
vercel env add GEN_PROVIDER_PRIMARY production
# 输入: fal

# 设置供应商权重 (Preview)
vercel env add GEN_PROVIDER_WEIGHTS preview
# 输入: {"fal":1.0,"runware":0.0}

# 设置供应商权重 (Production)
vercel env add GEN_PROVIDER_WEIGHTS production
# 输入: {"fal":1.0,"runware":0.0}

# 设置超时时间 (Preview)
vercel env add GEN_TIMEOUT_MS preview
# 输入: 8000

# 设置超时时间 (Production)
vercel env add GEN_TIMEOUT_MS production
# 输入: 8000

# 设置重试次数 (Preview)
vercel env add GEN_RETRY preview
# 输入: 2

# 设置重试次数 (Production)
vercel env add GEN_RETRY production
# 输入: 2

# 设置故障切换 (Preview)
vercel env add GEN_FAILOVER preview
# 输入: true

# 设置故障切换 (Production)
vercel env add GEN_FAILOVER production
# 输入: true
```

### 方法 2: 使用 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目: **family-mosaic-maker**
3. 进入 **Settings** → **Environment Variables**
4. 为每个变量点击 **Add New**，填写：
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://your-project.supabase.co`
   - **Environments**: 选择 Preview 或 Production
5. 重复步骤 4 设置以下变量：
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `FAL_API_KEY` (Preview & Production)
   - `FAL_MODEL_ID` (Preview & Production)

### 方法 3: 使用自动化脚本

```bash
# 设置环境变量后运行
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_ANON_KEY="your-anon-key" \
./scripts/setup-vercel-env-quick.sh
```

## ✅ 验证

### 1. 列出环境变量

```bash
vercel env ls
```

预期输出应包含：
- `NEXT_PUBLIC_USE_MOCK` (Preview=true, Production=false)
- `NEXT_PUBLIC_SUPABASE_URL` (Preview & Production)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Preview & Production)
- `FAL_API_KEY` (Preview & Production)
- `FAL_MODEL_ID` (Preview & Production)
- `RUNWARE_API_KEY` (Preview & Production, 可选)
- `GEN_PROVIDER_PRIMARY` (Preview & Production, 默认：fal)
- `GEN_PROVIDER_WEIGHTS` (Preview & Production, 默认：{"fal":1.0,"runware":0.0})
- `GEN_TIMEOUT_MS` (Preview & Production, 默认：8000)
- `GEN_RETRY` (Preview & Production, 默认：2)
- `GEN_FAILOVER` (Preview & Production, 默认：true)

### 2. 触发 Preview 重新部署

```bash
vercel deploy --prebuilt --prod=false --yes
```

### 3. 验证健康检查

```bash
# 获取 Preview URL
PREVIEW_URL=$(vercel ls | grep "Preview.*Ready" | awk '{print $NF}')

# 健康检查
curl -i "$PREVIEW_URL/api/health"
```

预期输出: `HTTP/2 200` + `{"ok":true,...}`

## 📝 验收命令

```bash
# 1. 确认键值
vercel env ls

# 2. Preview 重新部署
vercel deploy --prebuilt --prod=false --yes

# 3. 健康检查（查看 providers 状态）
curl -s <preview-url>/api/health | jq '.providers'
```

**预期输出**:
```json
{
  "fal": {
    "ok": true,
    "latency_ms": 125,
    "status": "ok",
    "error": null,
    "configured": true
  },
  "runware": {
    "ok": true,
    "latency_ms": 98,
    "status": "ok",
    "error": null,
    "configured": true,
    "deprecated": true
  },
  "config": {
    "primary": "fal",
    "weights": {
      "fal": 1.0,
      "runware": 0.0
    },
    "timeout_ms": 8000,
    "retry": 2,
    "failover": true
  }
}
```

## 🎯 完成状态

- ✅ `NEXT_PUBLIC_USE_MOCK` (Preview=true, Production=false)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` (Preview & Production) - 已设定
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Preview & Production) - 已设定
- ⚠️  `FAL_API_KEY` (Preview & Production) - 需设定
- ⚠️  `FAL_MODEL_ID` (Preview & Production) - 需设定
- ⚠️  `RUNWARE_API_KEY` (Preview & Production) - 需设定（可选）
- ⚠️  `GEN_PROVIDER_PRIMARY` (Preview & Production) - 需设定（默认：fal）
- ⚠️  `GEN_PROVIDER_WEIGHTS` (Preview & Production) - 需设定（默认：{"fal":1.0,"runware":0.0}）
- ⚠️  `GEN_TIMEOUT_MS` (Preview & Production) - 需设定（默认：8000）
- ⚠️  `GEN_RETRY` (Preview & Production) - 需设定（默认：2）
- ⚠️  `GEN_FAILOVER` (Preview & Production) - 需设定（默认：true）

**环境变量需手动设置！** 请使用以下命令：

```bash
# 设置 FAL API Key (Preview & Production)
vercel env add FAL_API_KEY preview
vercel env add FAL_API_KEY production

# 设置 FAL Model ID (Preview & Production)
vercel env add FAL_MODEL_ID preview
vercel env add FAL_MODEL_ID production

# 设置 Runware API Key (Preview & Production) - 可选
vercel env add RUNWARE_API_KEY preview
vercel env add RUNWARE_API_KEY production

# 设置主要供应商 (Preview & Production)
vercel env add GEN_PROVIDER_PRIMARY preview
vercel env add GEN_PROVIDER_PRIMARY production
# 输入: fal

# 设置供应商权重 (Preview & Production)
vercel env add GEN_PROVIDER_WEIGHTS preview
vercel env add GEN_PROVIDER_WEIGHTS production
# 输入: {"fal":1.0,"runware":0.0}

# 设置超时时间 (Preview & Production)
vercel env add GEN_TIMEOUT_MS preview
vercel env add GEN_TIMEOUT_MS production
# 输入: 8000

# 设置重试次数 (Preview & Production)
vercel env add GEN_RETRY preview
vercel env add GEN_RETRY production
# 输入: 2

# 设置故障切换 (Preview & Production)
vercel env add GEN_FAILOVER preview
vercel env add GEN_FAILOVER production
# 输入: true

# 验证设置
vercel env ls | egrep 'FAL_API_KEY|FAL_MODEL_ID|RUNWARE_API_KEY|GEN_PROVIDER|GEN_TIMEOUT|GEN_RETRY|GEN_FAILOVER'
```

## 📝 FAL 环境变量说明

### FAL_API_KEY
- **用途**: Fal.ai API 密钥，用于调用 FAL 模型生成服务
- **获取方式**: 访问 [Fal.ai Dashboard](https://fal.ai/dashboard) 获取 API Key
- **环境**: Preview & Production

### FAL_MODEL_ID
- **用途**: Fal.ai 模型 ID，指定要使用的模型
- **示例**: `fal-ai/flux/schnell` 或 `fal-ai/flux/dev`
- **环境**: Preview & Production

## 🚀 当前部署

### Preview 部署

- **URL**: `https://family-mosaic-maker-*.vercel.app` (动态预览 URL)
- **状态**: ✅ 已部署
- **环境变量**: 已应用最新配置
- **最后更新**: 2025-11-09

> **注意**: Preview URL 是动态生成的，每次部署都会变化。请使用 `vercel ls` 查看最新 Preview URL。

**获取最新 Preview URL:**
```bash
vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v "family-mosaic-maker\.vercel\.app" | head -1
```

### Production 部署

- **URL**: `https://family-mosaic-maker.vercel.app`
- **状态**: ✅ 已部署
- **环境变量**: 已应用最新配置
- **最后更新**: 2025-11-09

**健康检查:**
```bash
curl -i https://family-mosaic-maker.vercel.app/api/health
```

## 📚 相关文档

- [Vercel Environment Variables Checklist](./deploy/env-checklist.md)
- [Supabase Auth URL Configuration](./deploy/supabase-auth-urls.md)
- [Provider Dual Source Playbook](./provider_dual_source_playbook.md)


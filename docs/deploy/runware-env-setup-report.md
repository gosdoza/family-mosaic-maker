# RUNWARE 环境变量设置报告

**日期**: 2025-01-16  
**操作**: 在 Vercel Preview 和 Production 环境添加 RUNWARE_API_KEY 和 RUNWARE_ENV

## ✅ 完成状态

### 环境变量状态

通过 `vercel env ls` 验证，以下环境变量已存在于所有环境：

| 变量名 | 环境 | 状态 | 创建时间 |
|--------|------|------|----------|
| `RUNWARE_API_KEY` | Preview | ✅ 已存在 | 3 分钟前 |
| `RUNWARE_API_KEY` | Production | ✅ 已存在 | 3 分钟前 |
| `RUNWARE_ENV` | Preview | ✅ 已存在 | 3 分钟前 |
| `RUNWARE_ENV` | Production | ✅ 已存在 | 3 分钟前 |

### 验证命令

```bash
# 查看所有 RUNWARE 相关环境变量
vercel env ls | grep RUNWARE
```

**预期输出**:
```
RUNWARE_ENV                        Encrypted           Development, Preview, Production    3m ago     
RUNWARE_API_KEY                    Encrypted           Development, Preview, Production    3m ago
```

## ⚠️ 部署问题

### 问题描述

自动触发 Preview 重新部署时遇到错误：

```
Error: Hobby accounts are limited to daily cron jobs. 
This cron expression (0 */6 * * *) would run more than once per day. 
Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.
```

### 原因

`vercel.json` 中的 cron job 配置 `0 */6 * * *`（每 6 小时运行一次）超过了 Hobby 账户的限制（每天只能运行一次）。

### 解决方案

#### 方案 1: 通过 Vercel Dashboard 手动触发部署（推荐）

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目: **family-mosaic-maker**
3. 进入 **Deployments** 标签
4. 找到最新的部署，点击 **⋯** 菜单
5. 选择 **Redeploy**
6. 选择环境: **Preview**
7. 点击 **Redeploy**

#### 方案 2: 临时修改 cron job 配置

如果需要通过 CLI 部署，可以临时修改 `vercel.json` 中的 cron job 频率：

```json
{
  "crons": [
    {
      "path": "/api/gdpr/process",
      "schedule": "0 0 * * *"  // 改为每天一次
    }
  ]
}
```

然后重新部署：

```bash
vercel --prod=false --yes
```

#### 方案 3: 升级到 Pro 计划

升级到 Vercel Pro 计划以解锁所有 Cron Jobs 功能。

## 📝 验收步骤

### 1. 验证环境变量

```bash
vercel env ls | grep RUNWARE
```

**预期结果**: 应看到 `RUNWARE_API_KEY` 和 `RUNWARE_ENV` 在 Preview 和 Production 环境中。

### 2. 验证 Preview 网站

#### 方法 1: 通过 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目: **family-mosaic-maker**
3. 进入 **Deployments** 标签
4. 找到最新的 Preview 部署
5. 点击部署 URL 打开网站
6. 验证网站正常显示

#### 方法 2: 通过 API 健康检查

```bash
# 替换 <preview-url> 为实际的 Preview URL
curl -s https://<preview-url>/api/health | jq
```

**预期结果**: 应返回健康检查 JSON，包含 `ok: true`。

#### 方法 3: 检查 Providers 状态

```bash
curl -s https://<preview-url>/api/health | jq '.providers'
```

**预期结果**: 应看到 `runware` 配置信息。

### 3. 验证环境变量值

**注意**: Vercel CLI 无法直接查看加密的环境变量值。如果需要确认 `RUNWARE_ENV` 的值为 `production`，可以通过以下方式：

#### 方法 1: 在代码中输出（临时）

在 `app/api/health/route.ts` 中临时添加：

```typescript
console.log('RUNWARE_ENV:', process.env.RUNWARE_ENV)
```

然后查看部署日志。

#### 方法 2: 通过 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目: **family-mosaic-maker**
3. 进入 **Settings** → **Environment Variables**
4. 找到 `RUNWARE_ENV`
5. 点击查看（需要权限）
6. 确认值为 `production`

## 🔄 后续操作

### 如果需要更新 RUNWARE_ENV 的值

如果 `RUNWARE_ENV` 的值不是 `production`，可以更新：

```bash
# Preview 环境
vercel env add RUNWARE_ENV preview
# 输入: production

# Production 环境
vercel env add RUNWARE_ENV production
# 输入: production
```

### 如果需要更新 RUNWARE_API_KEY

```bash
# Preview 环境
vercel env add RUNWARE_API_KEY preview
# 输入: your-runware-api-key

# Production 环境
vercel env add RUNWARE_API_KEY production
# 输入: your-runware-api-key
```

### 使用自动化脚本

已创建自动化脚本 `scripts/ops/add-runware-env.sh`：

```bash
# 使用脚本（会提示输入 API Key）
./scripts/ops/add-runware-env.sh

# 或直接提供 API Key
./scripts/ops/add-runware-env.sh your-runware-api-key
```

## 📚 相关文档

- [Provider Dual Source Playbook](../provider_dual_source_playbook.md)
- [Vercel 环境变量矩阵](../VERCEL_ENV_MATRIX.md)
- [Runbook](../Runbook.md)

## ✅ 验收清单

- [x] `RUNWARE_API_KEY` 已存在于 Preview 环境
- [x] `RUNWARE_API_KEY` 已存在于 Production 环境
- [x] `RUNWARE_ENV` 已存在于 Preview 环境
- [x] `RUNWARE_ENV` 已存在于 Production 环境
- [ ] Preview 网站正常（需要手动触发部署后验证）
- [ ] `RUNWARE_ENV` 的值确认为 `production`（需要手动验证）

---

**报告生成时间**: 2025-01-16  
**操作人员**: [自动生成]  
**状态**: ✅ 环境变量已添加，等待手动触发部署验证




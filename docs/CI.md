# CI/CD 部署流程说明

## 📋 概述

本文档说明 CI/CD 部署流程，包括 Pre-deploy Guard 检查、环境变量要求和部署步骤。

## 🔒 Pre-deploy Guard

### 目的

Pre-deploy Guard 确保在部署到 Production 环境前，所有必要的配置都已正确设置，避免误上线。

### 检查规则

#### Production 环境

- **如果 `NEXT_PUBLIC_USE_MOCK=false`**:
  - ✅ **必须**配置 `FAL_API_KEY`
  - ❌ 如果 `FAL_API_KEY` 缺失或为空，部署将被阻止

- **如果 `NEXT_PUBLIC_USE_MOCK=true`**:
  - ⚠️ 允许部署（Mock 模式），但会显示警告

#### Preview 环境

- `FAL_API_KEY` 可选
- 如果未配置，会显示警告，将使用 Mock 模式

#### Development 环境

- `FAL_API_KEY` 可选
- 无检查限制

### 使用方法

#### 手动运行

```bash
# 运行 Pre-deploy Guard 检查
pnpm predeploy:guard
```

#### 自动运行

Pre-deploy Guard 已配置为 `predeploy` hook，会在以下情况自动运行：

1. **运行 `pnpm deploy` 时**:
   ```bash
   pnpm deploy
   # 会自动运行 predeploy:guard
   ```

2. **Vercel 部署时**:
   - Vercel 会自动运行 `predeploy` hook（如果存在）
   - 如果检查失败，部署将被阻止

#### 在 CI/CD 中集成

**GitHub Actions 示例**:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.15.1
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - name: Pre-deploy Guard
        run: pnpm predeploy:guard
        env:
          NODE_ENV: production
          NEXT_PUBLIC_USE_MOCK: false
          FAL_API_KEY: ${{ secrets.FAL_API_KEY }}
      - name: Build
        run: pnpm build:ci
      - name: Deploy
        run: pnpm deploy
```

**GitLab CI 示例**:

```yaml
deploy:
  stage: deploy
  script:
    - pnpm install
    - pnpm predeploy:guard
    - pnpm build:ci
    - pnpm deploy
  environment:
    name: production
  only:
    - main
  variables:
    NODE_ENV: production
    NEXT_PUBLIC_USE_MOCK: "false"
    FAL_API_KEY: $FAL_API_KEY
```

**CircleCI 示例**:

```yaml
version: 2.1
jobs:
  deploy:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: pnpm install
      - run: pnpm predeploy:guard
        environment:
          NODE_ENV: production
          NEXT_PUBLIC_USE_MOCK: false
          FAL_API_KEY: $FAL_API_KEY
      - run: pnpm build:ci
      - run: pnpm deploy
```

### 验收测试

#### 测试 Production 环境（缺少 Key）

```bash
NODE_ENV=production NEXT_PUBLIC_USE_MOCK=false FAL_API_KEY= \
  pnpm predeploy:guard || echo '✅ Gate 正常'
```

**预期输出**:
```
❌ 错误:
  ❌ Production 环境且 NEXT_PUBLIC_USE_MOCK=false 时，必须配置 FAL_API_KEY

部署被阻止。请配置 FAL_API_KEY 或设置 NEXT_PUBLIC_USE_MOCK=true
✅ Gate 正常
```

#### 测试 Production 环境（有 Key）

```bash
NODE_ENV=production NEXT_PUBLIC_USE_MOCK=false FAL_API_KEY=test-key \
  pnpm predeploy:guard && echo '✅ 检查通过'
```

**预期输出**:
```
✅ FAL_API_KEY 已配置

✅ Pre-deploy 检查通过
✅ 检查通过
```

#### 测试 Production 环境（Mock 模式）

```bash
NODE_ENV=production NEXT_PUBLIC_USE_MOCK=true FAL_API_KEY= \
  pnpm predeploy:guard && echo '✅ 检查通过'
```

**预期输出**:
```
⚠️  警告:
  ⚠️  Production 环境使用 NEXT_PUBLIC_USE_MOCK=true（Mock 模式），这是封测期允许的

✅ Pre-deploy 检查通过
✅ 检查通过
```

## 📦 部署流程

### Vercel 部署

#### 1. 设置环境变量

在 Vercel Dashboard 中设置以下环境变量：

**Production 环境**:
- `NEXT_PUBLIC_USE_MOCK`: `false`
- `FAL_API_KEY`: `<your-fal-api-key>`
- `FAL_MODEL_ID`: `<your-fal-model-id>`

**Preview 环境**:
- `NEXT_PUBLIC_USE_MOCK`: `true` (可选)
- `FAL_API_KEY`: `<your-fal-api-key>` (可选)
- `FAL_MODEL_ID`: `<your-fal-model-id>` (可选)

#### 2. 部署步骤

1. **推送代码到 Git**:
   ```bash
   git push origin main
   ```

2. **Vercel 自动部署**:
   - Vercel 会自动检测到新的推送
   - 运行 `predeploy` hook（如果存在）
   - 如果 Pre-deploy Guard 失败，部署将被阻止
   - 如果通过，继续构建和部署

3. **手动部署**:
   ```bash
   # 使用 Vercel CLI
   vercel --prod
   ```

### 本地部署测试

```bash
# 1. 运行 Pre-deploy Guard
pnpm predeploy:guard

# 2. 构建
pnpm build:ci

# 3. 启动（本地测试）
pnpm start
```

## 🔍 故障排查

### Pre-deploy Guard 失败

**问题**: 部署被 Pre-deploy Guard 阻止

**解决方案**:
1. 检查环境变量是否已正确设置
2. 确认 `FAL_API_KEY` 不为空
3. 如果使用 Mock 模式，设置 `NEXT_PUBLIC_USE_MOCK=true`

**检查命令**:
```bash
# 检查环境变量
echo $FAL_API_KEY
echo $NEXT_PUBLIC_USE_MOCK
echo $NODE_ENV
```

### Vercel 部署失败

**问题**: Vercel 部署失败，但 Pre-deploy Guard 通过

**解决方案**:
1. 检查 Vercel Dashboard 的构建日志
2. 确认所有环境变量已在 Vercel Dashboard 中设置
3. 检查 `vercel.json` 配置是否正确

## 📝 相关文档

- [Config Gate (Runbook)](./Runbook.md#config-gate配置門檻)
- [环境变量矩阵](./VERCEL_ENV_MATRIX.md)
- [Pre-deploy Guard 脚本](../scripts/predeploy-guard.js)

## 📝 更新日志

- **v1.0.0** (2025-01-16): 初始版本，添加 Pre-deploy Guard 检查和 CI/CD 流程说明




# QA 腳本總覽

本文檔列出所有可用的 QA 腳本及其用途。

## 📋 指令列表

### Mock E2E 相關

| 指令 | 腳本路徑 | 用途 |
|------|---------|------|
| `qa:mvp-e2e-smoke` | `scripts/qa/mvp-e2e-smoke.mjs` | MVP E2E Smoke Test（基本檢查） |
| `qa:mvp-generate-flow` | `scripts/qa/mvp-generate-flow.mjs` | Mock Generate Flow 完整流程 |
| `qa:mvp-pricing-flow` | `scripts/qa/mvp-pricing-flow.mjs` | Mock Pricing Flow 檢查 |
| `qa:mvp-orders-flow` | `scripts/qa/mvp-orders-flow.mjs` | Mock Orders Flow 檢查 |
| `qa:mock-e2e-all` | `scripts/qa/mvp-mock-e2e-all.mjs` | **Mock E2E 總整 Pipeline**（一次跑完所有 Mock 檢查） |

### Real E2E 相關

| 指令 | 腳本路徑 | 用途 |
|------|---------|------|
| `qa:real-generate-flow` | `scripts/qa/real-generate-flow.mjs` | Real Generate Flow（Runware 模式） |

### 其他 QA 腳本

| 指令 | 腳本路徑 | 用途 |
|------|---------|------|
| `qa:check-vercel-env` | `scripts/qa/check-vercel-env.mjs` | 檢查 Vercel 環境變數 |
| `qa:signed-url` | `scripts/qa/signed-url-smoke.mjs` | Signed URL 檢查 |

## 🚀 快速開始

### Mock E2E 完整流程

```bash
# Local
QA_BASE_URL="http://localhost:3000" pnpm qa:mock-e2e-all

# Production
QA_BASE_URL="https://family-mosaic-maker.vercel.app" pnpm qa:mock-e2e-all
```

### Real Generate Flow

```bash
# Local
QA_BASE_URL="http://localhost:3000" \
GENERATION_PROVIDER=runware \
RUNWARE_API_KEY=xxx \
pnpm qa:real-generate-flow

# Production
QA_BASE_URL="https://family-mosaic-maker.vercel.app" \
GENERATION_PROVIDER=runware \
RUNWARE_API_KEY=xxx \
pnpm qa:real-generate-flow
```

## 📚 相關文件

- [Mock E2E Pipeline 使用指南](./mvp-mock-e2e-pipeline.md)
- [Real Generate Flow 規格](../real-e2e/generate-flow.md)
- [MVP Generate Flow QA](./mvp-generate-flow.md)
- [MVP Pricing Flow QA](./mvp-pricing-flow.md)
- [MVP Orders Flow QA](./mvp-orders-flow.md)


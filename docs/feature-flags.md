# Feature Flags 說明

本文檔說明 Family Mosaic Maker 專案中的 Feature Flags 系統。

## 概述

Feature Flags 系統用於集中管理以下功能開關：
- **Runware 生成模式**：Mock vs Real
- **PayPal 支付模式**：Mock vs Sandbox vs Live
- **Demo 模式**：用於預覽環境的測試流程
- **環境檢測**：Preview vs Production

## 支援的環境變數

### 1. `NEXT_PUBLIC_DEMO_MODE`

**類型**: `"true" | undefined`

**說明**: 明確啟用 Demo 模式

**行為**:
- 啟用時，`isDemoMode` 為 `true`
- 在 Preview 環境下，允許 `/orders` 和 `/results/demo-001` 免登入訪問
- Mock 數據會自動返回給 `demo-001` jobs

**範例**:
```bash
NEXT_PUBLIC_DEMO_MODE=true
```

### 2. `NEXT_PUBLIC_RUNWARE_MODE`

**類型**: `"mock" | "real"`

**說明**: 控制 Runware 生成提供者

**允許的值**:
- `"mock"`: 使用 Mock Provider（預設）
- `"real"`: 使用真實 Runware API

**範例**:
```bash
NEXT_PUBLIC_RUNWARE_MODE=mock
NEXT_PUBLIC_RUNWARE_MODE=real
```

### 3. `NEXT_PUBLIC_PAYPAL_MODE`

**類型**: `"mock" | "sandbox" | "live"`

**說明**: 控制 PayPal 支付提供者

**允許的值**:
- `"mock"`: 使用 Mock PayPal（預設，安全）
- `"sandbox"`: 使用 PayPal Sandbox
- `"live"`: 使用真實 PayPal（生產環境）

**範例**:
```bash
NEXT_PUBLIC_PAYPAL_MODE=mock
NEXT_PUBLIC_PAYPAL_MODE=sandbox
```

### 4. `NEXT_PUBLIC_USE_MOCK` (Legacy)

**類型**: `"true" | undefined`

**說明**: 舊版 Mock 開關，保留用於向後兼容

**行為**:
- 當設定為 `"true"` 時，等同於：
  - `NEXT_PUBLIC_DEMO_MODE=true`
  - `NEXT_PUBLIC_RUNWARE_MODE=mock`
- 建議新專案使用新的 flags，但現有設定仍然有效

**範例**:
```bash
NEXT_PUBLIC_USE_MOCK=true
```

## 環境變數（自動檢測）

以下環境變數由 Vercel 自動設定，用於環境檢測：

- `VERCEL_ENV`: `"preview" | "production" | "development"`
- `NEXT_PUBLIC_VERCEL_ENV`: 同上（可在前端使用）

## 標準配置組合

### Demo / Mock 標準組合（目前 Preview 正在使用）

```bash
# 選項 1: 使用新 flags
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_RUNWARE_MODE=mock
NEXT_PUBLIC_PAYPAL_MODE=mock

# 選項 2: 使用舊 flag（向後兼容）
NEXT_PUBLIC_USE_MOCK=true
```

### Production 標準配置

```bash
# Production 應該使用 Mock（避免燒錢）
NEXT_PUBLIC_USE_MOCK=true
# 或
NEXT_PUBLIC_RUNWARE_MODE=mock
NEXT_PUBLIC_PAYPAL_MODE=mock
```

### Preview 測試真實 API

```bash
# Preview 環境測試真實 Runware
NEXT_PUBLIC_RUNWARE_MODE=real
RUNWARE_API_KEY=your_key_here
```

## 使用方式

在程式碼中引入：

```typescript
import {
  isDemoMode,
  isRunwareMock,
  isRunwareReal,
  isPaypalMock,
  isPaypalSandbox,
  isDemoJob,
  isPreviewEnv,
  isProdEnv,
} from "@/lib/featureFlags"

// 檢查是否為 demo job
if (isDemoJob(jobId)) {
  // 特殊處理
}

// 檢查是否使用 mock Runware
if (isRunwareMock) {
  // 使用 mock provider
}

// 檢查是否在 preview 環境
if (isPreviewEnv) {
  // Preview 特定邏輯
}
```

## 重要提醒

⚠️ **本次重構只改變判斷方式，不改變實際行為**

- 所有現有的 Route A、Route C、Route D 行為保持不變
- Middleware 的保護邏輯保持不變
- API 的 mock/real 切換邏輯保持不變

## 未來擴充

當需要接入真實 API 時，只需調整環境變數：

```bash
# 切換到真實 Runware
NEXT_PUBLIC_RUNWARE_MODE=real
RUNWARE_API_KEY=your_key

# 切換到 PayPal Sandbox
NEXT_PUBLIC_PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
```


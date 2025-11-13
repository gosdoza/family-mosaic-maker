# PayPal Sandbox 環境變數與保護機制

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档说明 PayPal Sandbox 环境变量的配置和保护机制，包括 idempotency 规范和测试绕过说明。

## 📋 目錄

- [環境變數概覽](#環境變數概覽)
- [環境矩陣](#環境矩陣)
- [環境變數詳解](#環境變數詳解)
- [保護機制](#保護機制)
- [繞過測試說明](#繞過測試說明)
- [驗收命令](#驗收命令)

## 🔑 環境變數概覽

### 必需環境變數

| 環境變數 | 說明 | 類型 | 必填 |
|---------|------|------|------|
| `PAYPAL_CLIENT_ID` | PayPal 應用程式 Client ID | `string` | ✅ Yes |
| `PAYPAL_CLIENT_SECRET` | PayPal 應用程式 Client Secret | `string` | ✅ Yes |
| `PAYPAL_WEBHOOK_ID` | PayPal Webhook ID（用於驗證） | `string` | ⚠️ Optional |
| `PAYPAL_ENV` | PayPal 環境（`sandbox` 或 `production`） | `string` | ⚠️ Optional |

### 環境變數說明

**1. `PAYPAL_CLIENT_ID`**:
- **用途**: PayPal 應用程式的 Client ID，用於 OAuth 認證
- **格式**: 字符串（如 `sb-xxx` 表示 Sandbox，`xxx` 表示 Production）
- **獲取方式**: PayPal Developer Dashboard → Applications → 選擇應用程式 → Client ID

**2. `PAYPAL_CLIENT_SECRET`**:
- **用途**: PayPal 應用程式的 Client Secret，用於 OAuth 認證
- **格式**: 字符串（敏感信息，需保密）
- **獲取方式**: PayPal Developer Dashboard → Applications → 選擇應用程式 → Secret

**3. `PAYPAL_WEBHOOK_ID`**:
- **用途**: PayPal Webhook ID，用於驗證 Webhook 簽名
- **格式**: 字符串（如 `WH-xxx`）
- **獲取方式**: PayPal Developer Dashboard → Webhooks → 選擇 Webhook → Webhook ID

**4. `PAYPAL_ENV`**:
- **用途**: 指定 PayPal 環境（Sandbox 或 Production）
- **格式**: `sandbox` 或 `production`（默認根據 `PAYPAL_CLIENT_ID` 判斷）
- **默認值**: 如果 `PAYPAL_CLIENT_ID` 包含 `sandbox` 或 `sb-`，則為 `sandbox`，否則為 `production`

## 📊 環境矩陣

### Preview 環境

| 環境變數 | 值 | 說明 |
|---------|-----|------|
| `PAYPAL_CLIENT_ID` | `sb-xxx` (Sandbox) | Preview 環境使用 Sandbox Client ID |
| `PAYPAL_CLIENT_SECRET` | `xxx` (Sandbox) | Preview 環境使用 Sandbox Client Secret |
| `PAYPAL_WEBHOOK_ID` | `WH-xxx` (Sandbox) | Preview 環境使用 Sandbox Webhook ID |
| `PAYPAL_ENV` | `sandbox` | Preview 環境固定為 Sandbox |

### Production 環境

| 環境變數 | 值 | 說明 |
|---------|-----|------|
| `PAYPAL_CLIENT_ID` | `xxx` (Production) | Production 環境使用 Production Client ID |
| `PAYPAL_CLIENT_SECRET` | `xxx` (Production) | Production 環境使用 Production Client Secret |
| `PAYPAL_WEBHOOK_ID` | `WH-xxx` (Production) | Production 環境使用 Production Webhook ID |
| `PAYPAL_ENV` | `production` | Production 環境固定為 Production |

### 環境判斷邏輯

**自動判斷**:
```typescript
// 根據 PAYPAL_CLIENT_ID 自動判斷環境
const isSandbox = 
  process.env.PAYPAL_CLIENT_ID?.includes("sandbox") || 
  process.env.PAYPAL_CLIENT_ID?.includes("sb-") ||
  !process.env.PAYPAL_CLIENT_ID

const baseUrl = isSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com"
```

**手動指定**:
```typescript
// 使用 PAYPAL_ENV 手動指定環境
const isSandbox = process.env.PAYPAL_ENV === "sandbox"

const baseUrl = isSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com"
```

## 🔐 環境變數詳解

### 1. PAYPAL_CLIENT_ID

**用途**: PayPal 應用程式的 Client ID

**格式**:
- **Sandbox**: `sb-xxx` 或包含 `sandbox` 的字符串
- **Production**: 不包含 `sandbox` 或 `sb-` 的字符串

**範例**:
```bash
# Sandbox
PAYPAL_CLIENT_ID=sb-1234567890abcdef

# Production
PAYPAL_CLIENT_ID=1234567890abcdef
```

**獲取方式**:
1. 登入 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
2. 選擇應用程式（Sandbox 或 Production）
3. 複製 Client ID

**安全注意事項**:
- ✅ 可以公開（Client ID 不是敏感信息）
- ✅ 可以提交到版本控制（但建議使用環境變數）
- ⚠️ 不要與 Client Secret 混淆

### 2. PAYPAL_CLIENT_SECRET

**用途**: PayPal 應用程式的 Client Secret

**格式**: 字符串（敏感信息）

**範例**:
```bash
# Sandbox
PAYPAL_CLIENT_SECRET=SB_SECRET_1234567890abcdef

# Production
PAYPAL_CLIENT_SECRET=SECRET_1234567890abcdef
```

**獲取方式**:
1. 登入 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
2. 選擇應用程式（Sandbox 或 Production）
3. 點擊 "Show" 顯示 Secret
4. 複製 Client Secret

**安全注意事項**:
- ❌ **絕對不要**提交到版本控制
- ❌ **絕對不要**公開分享
- ✅ 僅在服務器端使用
- ✅ 使用環境變數存儲
- ✅ 定期輪換（如需要）

### 3. PAYPAL_WEBHOOK_ID

**用途**: PayPal Webhook ID，用於驗證 Webhook 簽名

**格式**: 字符串（如 `WH-xxx`）

**範例**:
```bash
# Sandbox
PAYPAL_WEBHOOK_ID=WH-1234567890abcdef

# Production
PAYPAL_WEBHOOK_ID=WH-1234567890abcdef
```

**獲取方式**:
1. 登入 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
2. 選擇應用程式（Sandbox 或 Production）
3. 前往 "Webhooks" 頁面
4. 選擇或創建 Webhook
5. 複製 Webhook ID

**安全注意事項**:
- ✅ 可以公開（Webhook ID 不是敏感信息）
- ✅ 用於驗證 Webhook 簽名，防止偽造請求

### 4. PAYPAL_ENV

**用途**: 指定 PayPal 環境（Sandbox 或 Production）

**格式**: `sandbox` 或 `production`

**範例**:
```bash
# Sandbox
PAYPAL_ENV=sandbox

# Production
PAYPAL_ENV=production
```

**默認行為**:
- 如果未設置，系統會根據 `PAYPAL_CLIENT_ID` 自動判斷
- 如果 `PAYPAL_CLIENT_ID` 包含 `sandbox` 或 `sb-`，則為 `sandbox`
- 否則為 `production`

**使用場景**:
- 明確指定環境（避免自動判斷錯誤）
- 測試環境切換
- 多環境部署

## 🛡️ 保護機制

### 1. Idempotency 規範

**目的**: 防止重複處理相同的 Webhook 事件

**實現方式**: 使用 `X-Idempotency-Key` 請求頭

**規範**:
- **請求頭名稱**: `X-Idempotency-Key`
- **格式**: 字符串（建議使用 UUID 或事件 ID）
- **用途**: 標識唯一的事件，用於去重

**範例**:
```typescript
// 發送請求時包含 Idempotency Key
const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'X-Idempotency-Key': `idempotency-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  },
  body: JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: '2.99',
      },
    }],
  }),
})
```

**Webhook 處理**:
```typescript
// 檢查事件是否已處理（Idempotency）
const eventId = body?.id || body?.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
const alreadyProcessed = await hasWebhookEventBeenProcessed(eventId)

if (alreadyProcessed) {
  console.log(`Webhook event ${eventId} already processed, returning 200 (idempotency)`)
  return NextResponse.json(
    { status: "already_processed", success: true, message: "Event already processed" },
    { status: 200 }
  )
}

// 記錄事件（用於 Idempotency）
await recordWebhookEvent(eventId, resourceId, eventType)
```

**最佳實踐**:
- ✅ 使用唯一的事件 ID（如 PayPal 事件 ID）
- ✅ 在處理事件前檢查是否已處理
- ✅ 記錄已處理的事件（用於去重）
- ✅ 返回 200 狀態碼（即使事件已處理，避免 PayPal 重試）

### 2. Webhook 簽名驗證

**目的**: 驗證 Webhook 請求來自 PayPal

**實現方式**: 使用 `PAYPAL_WEBHOOK_ID` 驗證簽名

**驗證流程**:
1. 接收 Webhook 請求
2. 提取 PayPal 簽名頭（`paypal-transmission-id`, `paypal-transmission-time`, `paypal-cert-url`, `paypal-auth-algo`, `paypal-transmission-sig`）
3. 調用 PayPal 驗證 API 驗證簽名
4. 如果驗證失敗，記錄錯誤但返回 200（避免 PayPal 重試）

**範例**:
```typescript
// 驗證 PayPal Webhook 簽名
if (!IS_MOCK && PAYPAL_WEBHOOK_ID) {
  const isValid = await verifyPayPalWebhookSignature(
    request.headers,
    body,
    PAYPAL_WEBHOOK_ID
  )

  if (!isValid) {
    console.error(`PayPal webhook signature verification failed for event ${eventId}`)
    // 仍然返回 200 以防止 PayPal 重試
    // 但記錄錯誤用於監控
    return NextResponse.json(
      { error: "Invalid signature", success: false },
      { status: 200 }
    )
  }
}
```

**安全注意事項**:
- ✅ 在非 Mock 模式下啟用簽名驗證
- ✅ 使用 `PAYPAL_WEBHOOK_ID` 驗證簽名
- ✅ 驗證失敗時記錄錯誤但返回 200（避免 PayPal 重試）
- ⚠️ Mock 模式下跳過簽名驗證（用於測試）

### 3. 環境隔離

**目的**: 防止 Sandbox 和 Production 環境混淆

**實現方式**:
- 使用不同的環境變數（Preview 使用 Sandbox，Production 使用 Production）
- 根據 `PAYPAL_CLIENT_ID` 或 `PAYPAL_ENV` 自動判斷環境
- 使用不同的 API 端點（Sandbox vs Production）

**環境判斷**:
```typescript
// 自動判斷環境
const isSandbox = 
  process.env.PAYPAL_CLIENT_ID?.includes("sandbox") || 
  process.env.PAYPAL_CLIENT_ID?.includes("sb-") ||
  process.env.PAYPAL_ENV === "sandbox" ||
  !process.env.PAYPAL_CLIENT_ID

const baseUrl = isSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com"
```

**安全注意事項**:
- ✅ Preview 環境必須使用 Sandbox 憑證
- ✅ Production 環境必須使用 Production 憑證
- ❌ 不要將 Sandbox 憑證用於 Production
- ❌ 不要將 Production 憑證用於 Preview

## 🧪 繞過測試說明

### Mock 模式

**目的**: 在開發和測試環境中繞過真實的 PayPal 集成

**實現方式**: 使用 `NEXT_PUBLIC_USE_MOCK=true` 環境變數

**行為**:
- ✅ 跳過 PayPal API 調用
- ✅ 跳過 Webhook 簽名驗證
- ✅ 直接創建已付費訂單（用於測試）
- ✅ 返回模擬的 PayPal 響應

**範例**:
```typescript
// Mock 模式檢查
const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

if (IS_MOCK) {
  // 在 Mock 模式下，直接創建已付費訂單
  const order = await createOrderRecord({
    jobId: resultJobId,
    status: "paid",
    approvalUrl: `/results/${resultJobId}?paid=1`,
    amountCents: Math.round(amount * 100),
    currency: "USD",
  })

  return NextResponse.json({
    approvalUrl: `/results/${resultJobId}?paid=1`,
    orderId: order.id,
    jobId: resultJobId,
  })
}
```

**使用場景**:
- 本地開發測試
- E2E 測試
- Preview 部署測試（可選）

### 測試環境變數

**Preview 環境（可選 Mock）**:
```bash
# 選項 1: 使用 Mock 模式（跳過 PayPal）
NEXT_PUBLIC_USE_MOCK=true

# 選項 2: 使用 Sandbox 模式（真實 PayPal Sandbox）
NEXT_PUBLIC_USE_MOCK=false
PAYPAL_CLIENT_ID=sb-xxx
PAYPAL_CLIENT_SECRET=SB_SECRET_xxx
PAYPAL_WEBHOOK_ID=WH-xxx
PAYPAL_ENV=sandbox
```

**Production 環境（必須真實）**:
```bash
# 必須使用 Production 模式
NEXT_PUBLIC_USE_MOCK=false
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=SECRET_xxx
PAYPAL_WEBHOOK_ID=WH-xxx
PAYPAL_ENV=production
```

### 繞過測試流程

**1. Mock 模式測試**:
```bash
# 設置 Mock 模式
export NEXT_PUBLIC_USE_MOCK=true

# 啟動開發服務器
pnpm dev

# 測試結帳流程（會跳過 PayPal，直接創建已付費訂單）
# 訪問 /pricing → 點擊 "Pay with PayPal" → 直接跳轉到 /results?id=xxx&paid=1
```

**2. Sandbox 模式測試**:
```bash
# 設置 Sandbox 環境變數
export NEXT_PUBLIC_USE_MOCK=false
export PAYPAL_CLIENT_ID=sb-xxx
export PAYPAL_CLIENT_SECRET=SB_SECRET_xxx
export PAYPAL_WEBHOOK_ID=WH-xxx
export PAYPAL_ENV=sandbox

# 啟動開發服務器
pnpm dev

# 測試結帳流程（會調用 PayPal Sandbox API）
# 訪問 /pricing → 點擊 "Pay with PayPal" → 跳轉到 PayPal Sandbox 登入頁面
```

**3. Webhook 測試**:
```bash
# 使用 ngrok 暴露本地服務器
ngrok http 3000

# 在 PayPal Developer Dashboard 配置 Webhook URL
# https://your-ngrok-url.ngrok.io/api/webhook/paypal

# 測試 Webhook（使用 PayPal Webhook 測試工具或真實事件）
```

## 📋 驗收命令

### 檢查環境變數

```bash
# 檢查所有 PayPal 相關環境變數
vercel env ls | grep PAYPAL
```

**預期輸出**:
```
PAYPAL_CLIENT_ID          Preview, Production
PAYPAL_CLIENT_SECRET      Preview, Production
PAYPAL_WEBHOOK_ID         Preview, Production
PAYPAL_ENV                Preview, Production
```

### 驗證環境變數設置

```bash
# 檢查 Preview 環境變數
vercel env ls --environment preview | grep PAYPAL

# 檢查 Production 環境變數
vercel env ls --environment production | grep PAYPAL
```

### 測試環境變數

```bash
# 測試環境變數是否正確設置
node -e "console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID)"
node -e "console.log('PAYPAL_ENV:', process.env.PAYPAL_ENV || 'auto-detect')"
```

## 📚 相關文檔

- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
- [PayPal Webhook 文檔](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [PayPal Idempotency 文檔](https://developer.paypal.com/docs/api/orders/v2/#orders_create)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 PayPal Sandbox 環境變數與保護機制




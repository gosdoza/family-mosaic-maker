# 🧪 PayPal Mock Checkout Flow 測試文檔

## 測試概述

此測試驗證從 `/pricing` → `/api/payments/create` → `/results?id=demo-001&paid=1` 的完整 PayPal Mock Checkout 流程。

## 測試流程

### 1. 打開 `/pricing` 頁面

- ✅ 驗證 "Free vs Premium" 標題可見
- ✅ 驗證 "Try It Out" (Free tier) 可見
- ✅ 驗證 "Premium" tier 可見
- ✅ 驗證 "Pay with PayPal - $2.99" 按鈕存在

### 2. 點擊 PayPal 按鈕

- ✅ 按鈕調用 `POST /api/payments/create`
- ✅ API 返回 `{ approvalUrl: "/results/demo-001?paid=1", orderId: "..." }`

### 3. 自動重定向

- ✅ 重定向到 `/results/demo-001?paid=1`
- ✅ URL 包含 `id=demo-001` 和 `paid=1` 參數

### 4. Results 頁面驗證

- ✅ 頁面顯示 "Paid ✅" 狀態
- ✅ Mock 圖片正確渲染（2 張圖片）
- ✅ 圖片 src 為 `/assets/mock/family1.jpg` 和 `/assets/mock/family2.jpg`
- ✅ 無未處理的錯誤

### 5. Webhook 驗證

- ✅ `/api/webhook/paypal` 端點獨立測試通過
- ✅ 接收 `PAYMENT.CAPTURE.COMPLETED` 事件
- ✅ 返回成功響應

## 運行測試

```bash
# 運行 PayPal Checkout Flow 測試
pnpm test:e2e tests/paypal-checkout-flow.spec.ts

# 運行所有測試
pnpm test:e2e
```

## 測試結果

### 通過的測試

1. ✅ **Free → Premium checkout flow should work correctly**
   - 完整流程測試通過
   - 所有驗證點都通過

2. ✅ **Webhook endpoint should handle POST requests independently**
   - Webhook 端點獨立測試通過
   - 正確處理 `PAYMENT.CAPTURE.COMPLETED` 事件

## API 端點

### `/api/payments/create`

**請求:**
```json
{
  "plan": "premium",
  "amount": 2.99,
  "jobId": "demo-001"
}
```

**響應 (Mock 模式):**
```json
{
  "approvalUrl": "/results/demo-001?paid=1",
  "orderId": "order_1234567890"
}
```

### `/api/webhook/paypal`

**請求:**
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "payment_123",
    "status": "COMPLETED",
    "amount": {
      "total": "2.99",
      "currency": "USD"
    }
  }
}
```

**響應:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## 預期結果

✅ **流暢的重定向** → **Paid 狀態可見** → **Mock webhook 成功觸發**

## 手動測試步驟

1. 訪問 http://localhost:3000/pricing
2. 點擊 "Pay with PayPal - $2.99" 按鈕
3. 確認自動重定向到 `/results/demo-001?paid=1`
4. 確認頁面顯示 "Paid ✅"
5. 確認 2 張 mock 圖片正確顯示
6. 檢查瀏覽器控制台，確認無錯誤

## 注意事項

- 測試在 Mock 模式下運行 (`NEXT_PUBLIC_USE_MOCK=true`)
- Webhook 調用是異步的，可能需要等待
- 在生產環境中，需要配置真實的 PayPal webhook URL

## 實戰前硬化清單

### 環境變數設定

在 `.env.local` 中設定：

```bash
# Server-side mock flag
USE_MOCK=true

# Client-side mock flag
NEXT_PUBLIC_USE_MOCK=true

# PayPal Webhook ID (for production)
PAYPAL_WEBHOOK_ID=REPLACE_ME
```

### 數據庫遷移

執行 Supabase 遷移以創建 `orders` 和 `webhook_events` 表：

```bash
# 使用 Supabase CLI
supabase db push

# 或手動執行 SQL
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/20250115000000_add_orders.sql
```

### Mock / Prod 切換

1. **Mock 模式** (`USE_MOCK=true`, `NEXT_PUBLIC_USE_MOCK=true`):
   - 所有訂單立即標記為 `paid`
   - Webhook 驗證被跳過
   - 使用內存存儲 webhook 事件（idempotency）

2. **生產模式** (`USE_MOCK=false`, `NEXT_PUBLIC_USE_MOCK=false`):
   - 訂單狀態由 PayPal webhook 更新
   - Webhook 驗證必須實現（TODO）
   - 使用 Supabase 存儲 webhook 事件

### 待完成項目

- [ ] 實現 PayPal webhook 簽名驗證
- [ ] 集成真實 PayPal API（創建訂單、獲取 approval URL）
- [ ] 配置 PayPal webhook URL（指向 `/api/webhook/paypal`）
- [ ] 設置 PayPal webhook ID 環境變數
- [ ] 測試真實 PayPal 流程

---

**最後更新**: 2025-01-15
**測試狀態**: ✅ 通過


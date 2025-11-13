# MVP Pricing Flow (Mock) 驗收指南

**版本**: v1.0.0  
**建立日期**: 2025-11-13  
**目標**: 提供完整的 Pricing Flow（Mock 版）驗收步驟，確保 E2E 路徑可驗收

---

## 📋 概述

本文件描述從 `/pricing` → "Pay with PayPal" → `/results?id=demo-001&paid=1` → `/orders` 的完整 Mock 流程，所有步驟都**不需要實際 PayPal 支付**，適合開發與測試環境。

**前置條件**：
- `NEXT_PUBLIC_USE_MOCK=true` 環境變數已設定
- 不需要任何 PayPal API Key 或真實支付
- 需要登入（某些 API 端點需要認證）

---

## 🎯 預期 Mock 行為

### 1. Pricing 頁面 (`/pricing`)

**URL**: `/pricing` 或 `/pricing?job=demo-001`

**預期 UI**：
- ✅ 顯示 Free vs Premium 兩個方案
- ✅ Premium 方案顯示價格：**$2.99**
- ✅ Premium 方案有「Pay with PayPal」CTA 按鈕
- ✅ 按鈕文字包含 "Pay with PayPal" 和 "$2.99"
- ✅ 當有 `job` query 參數時，按鈕可點擊（`canPay = true`）

**行為**：
- 點擊「Pay with PayPal」按鈕時：
  - 顯示 loading 狀態（"Processing..."）
  - 呼叫 `POST /api/checkout`，body: `{ jobId: "demo-001", price: "2.99" }`
  - 收到回應後，使用 `approvalUrl` 欄位進行 redirect
  - 在 Mock 模式下，`approvalUrl` 應該是：`/results?id=demo-001&paid=1`

---

### 2. Checkout API (`POST /api/checkout`)

**端點**: `POST /api/checkout`

**認證要求**: ✅ **需要認證**（未登入會返回 401 Unauthorized）

**請求格式**:
```json
{
  "jobId": "demo-001",
  "price": "2.99"
}
```

**Headers**:
- `Content-Type: application/json`
- `X-Idempotency-Key: checkout_{timestamp}_{random}`

**Mock 模式響應** (200 OK):
```json
{
  "approvalUrl": "/results?id=demo-001&paid=1",
  "orderId": "ord_1234567890",
  "jobId": "demo-001",
  "request_id": "req_xxx"
}
```

**重要**：
- 在 Mock 模式下，`approvalUrl` **直接指向** `/results?id={jobId}&paid=1`
- **跳過真實 PayPal 批准頁面**
- 訂單會自動標記為 `status: "paid"` 並存入 e2eStore

---

### 3. Results 頁面（已付費狀態）

**URL**: `/results?id=demo-001&paid=1`

**預期 UI**：
- ✅ 頁面正常載入（HTTP 200）
- ✅ 顯示 Mock 圖片（2-4 張）
- ✅ 顯示「Premium」或「Paid」狀態標記（Badge 或文字）
- ✅ 顯示「Premium download unlocked」或類似文案
- ✅ 「Download HD」按鈕可用（不會提示升級）
- ✅ 圖片沒有 watermark（或顯示「No watermark」提示）

**未付費狀態對比** (`/results?id=demo-001`):
- 顯示「Preview only」或「Upgrade to Premium」提示
- 「Download HD」按鈕點擊會提示升級
- 圖片可能有 watermark

---

### 4. Orders 頁面

**URL**: `/orders`

**預期 UI**：
- ✅ 頁面正常載入（HTTP 200）
- ✅ 顯示訂單列表
- ✅ 至少包含一筆與 `demo-001` 相關的訂單
- ✅ 訂單顯示：
  - Job ID: `demo-001`
  - 狀態: `Completed` 或 `Paid`
  - 付費狀態: `paid`
  - 日期
  - 縮略圖

---

## 🔐 認證要求

### 需要認證的端點

以下端點在**未登入狀態**下會返回 `401 Unauthorized`：

- ✅ `POST /api/checkout` - 需要認證
- ✅ `POST /api/paypal/capture` - 需要認證
- ✅ `GET /api/orders` - 需要認證（依專案設定）

### 不需要認證的端點

- ✅ `GET /pricing` - 公開頁面
- ✅ `GET /results?id=demo-001&paid=1` - 公開頁面（但可能需要登入才能看到某些功能）

**說明**：
- 對於 MVP Mock 驗收，**匿名 API 呼叫返回 401 是預期行為**
- UI 層級的 E2E 驗證需要在登入後手動進行
- QA 腳本會明確標記「Expected: protected route requires auth (401)」

---

## ✅ 驗收 Checklist

### A. Pricing 頁面布局與價格文案

- [ ] `/pricing` 頁面正常載入（HTTP 200）
- [ ] 顯示 Free 和 Premium 兩個方案
- [ ] Premium 方案顯示價格 **$2.99**
- [ ] Premium 方案有「Pay with PayPal」按鈕
- [ ] 按鈕文字包含 "Pay with PayPal" 和 "$2.99"
- [ ] 當 URL 有 `?job=demo-001` 時，按鈕可點擊

### B. Mock Checkout API 契約

- [ ] `POST /api/checkout` 在 Mock 模式下返回 `approvalUrl`
- [ ] `approvalUrl` 格式為 `/results?id={jobId}&paid=1`
- [ ] 未登入時返回 401（預期行為）
- [ ] 已登入時返回 200 並包含 `approvalUrl`

### C. Results 頁面（`paid=1`）

- [ ] `/results?id=demo-001&paid=1` 正常載入
- [ ] 顯示「Premium」或「Paid」狀態標記
- [ ] 顯示「Premium download unlocked」或類似文案
- [ ] 「Download HD」按鈕可用
- [ ] 圖片正常顯示（使用本地 mock 圖片）

### D. Orders 頁面與 Mock 訂單

- [ ] `/orders` 頁面正常載入
- [ ] 顯示至少一筆與 `demo-001` 相關的訂單
- [ ] 訂單狀態顯示為 `paid` 或 `Completed`
- [ ] 訂單包含 Job ID、日期、縮略圖等資訊

### E. Pricing APIs 認證保護

- [ ] `POST /api/checkout` 未登入時返回 401（預期）
- [ ] `POST /api/paypal/capture` 未登入時返回 401（預期）
- [ ] `GET /api/orders` 未登入時返回 401 或 30x redirect（預期）

---

## 🔧 測試工具

### 快速測試（使用 demo-001）

1. **測試 Pricing 頁面**：
   ```
   https://family-mosaic-maker.vercel.app/pricing?job=demo-001
   ```

2. **測試已付費 Results**：
   ```
   https://family-mosaic-maker.vercel.app/results?id=demo-001&paid=1
   ```

3. **測試 Orders 頁面**：
   ```
   https://family-mosaic-maker.vercel.app/orders
   ```

### 完整流程測試（需要登入）

1. 登入（使用 Magic Link）
2. 訪問 `/pricing?job=demo-001`
3. 點擊「Pay with PayPal」
4. 驗證自動 redirect 到 `/results?id=demo-001&paid=1`
5. 驗證 Results 頁面顯示 Premium 狀態
6. 訪問 `/orders` 驗證訂單出現

---

## 📝 注意事項

1. **Mock 模式限制**：
   - 所有支付都是 Mock 的，不會實際扣款
   - `approvalUrl` 直接指向 Results 頁面，跳過 PayPal 批准頁面
   - 訂單自動標記為 `paid`，不需要實際 PayPal webhook

2. **認證要求**：
   - Checkout API 需要登入
   - UI 層級的完整流程需要在登入後測試
   - QA 腳本會明確標記認證保護為「預期行為」

3. **環境變數**：
   - 確保 `NEXT_PUBLIC_USE_MOCK=true` 已設定
   - 不需要設定 `PAYPAL_CLIENT_ID` 或 `PAYPAL_CLIENT_SECRET`

---

## 🐛 疑難排解

### 問題：Checkout API 返回 401

**可能原因**：
- 未登入
- Session 過期

**解決方法**：
- 這是預期行為（API 需要認證）
- 在 UI 層級測試時，確保已登入

### 問題：點擊「Pay with PayPal」後沒有 redirect

**可能原因**：
- API 返回錯誤
- `approvalUrl` 欄位缺失

**解決方法**：
- 檢查瀏覽器 Console 是否有錯誤
- 檢查 Network 標籤，確認 `/api/checkout` 的回應
- 確認 Mock 模式已啟用

### 問題：Results 頁面沒有顯示 Premium 狀態

**可能原因**：
- `paid=1` query 參數未傳遞給 API
- API 未正確處理 `paid` 參數

**解決方法**：
- 確認 URL 包含 `paid=1`
- 檢查 `/api/results/demo-001?paid=1` 的回應

---

## 📚 相關文件

- [API 契約](./api/generate-contract.md) - Generate/Progress/Results API 定義
- [PayPal Mock 測試](./tests/paypal-mock.md) - PayPal Mock 詳細測試步驟
- [MVP Generate Flow](./mvp-generate-flow.md) - Generate Flow 驗收指南

---

## 🔄 如何執行自動化 QA

執行以下命令：

```bash
pnpm qa:mvp-pricing-flow
```

或使用自訂 base URL：

```bash
QA_BASE_URL="http://localhost:3000" pnpm qa:mvp-pricing-flow
```

腳本會檢查：
- **A. Pricing page** - `/pricing` 頁面是否正常載入並包含價格文案
- **B. Results page with paid=1** - `/results?id=demo-001&paid=1` 是否顯示 Premium 狀態
- **C. Orders page** - `/orders` 頁面是否包含 mock 訂單
- **D. POST /api/checkout** - Checkout API 的認證保護（預期 401）
- **E. GET /api/orders** - Orders API 的認證保護（預期 401）
- **F. GET /api/paypal/confirm** - PayPal confirm API 行為
- **G. POST /api/paypal/capture** - PayPal capture API 的認證保護（預期 401）

**注意**：腳本會明確標記認證保護為「預期行為」，不會因為 401 而失敗。

---

## 📋 最小化手動 QA

對於已登入的使用者，執行以下步驟：

### 步驟 1: 登入

1. 訪問 `/auth/login`
2. 輸入 email，請求 Magic Link
3. 點擊 Magic Link 完成登入
4. 確認被導向到 `/dashboard`

### 步驟 2: 訪問 Pricing 頁面

1. 訪問 `/pricing?job=demo-001`
2. 確認 Premium 方案顯示 **$2.99**
3. 確認「Pay with PayPal」按鈕可點擊（不是 disabled）
4. 確認按鈕文字包含 "Pay with PayPal" 和 "$2.99"

### 步驟 3: 觸發 Checkout

1. 點擊「Pay with PayPal」按鈕
2. 確認按鈕顯示 loading 狀態（"Processing..."）
3. 確認顯示 success toast（"Payment Successful"）
4. 確認瀏覽器自動 redirect 到 `/results?id=demo-001&paid=1`

### 步驟 4: 驗證 Results 頁面（已付費狀態）

1. 確認 URL 包含 `paid=1`
2. 確認頁面顯示 **"Paid ✅"** badge（綠色背景）
3. 確認**沒有**顯示 "Premium unlocks HD" 的黃色提示
4. 確認「Download HD」按鈕可用（不是 disabled）
5. 確認圖片正常顯示（沒有 watermark overlay）
6. 確認圖片沒有 grayscale/blur 效果

### 步驟 5: 驗證 Orders 頁面

1. 訪問 `/orders`
2. 確認頁面正常載入
3. 確認顯示至少一筆與 `demo-001` 相關的訂單
4. 確認訂單狀態顯示為 **"Completed"** 或 **"Paid"**
5. 確認訂單的 `paymentStatus` 為 `paid`
6. 確認訂單包含 Job ID、日期、縮略圖等資訊

---

## 📝 更新日誌

- **v1.0.0** (2025-11-13): 初始版本，定義 MVP Pricing Flow (Mock) 驗收規格


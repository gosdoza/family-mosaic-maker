# PayPal Webhook 流程圖與對帳補償

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档描述 PayPal 支付流程（create → capture → webhook → confirm）和补偿逻辑（扣款成功前端失联 → 自动补发凭证）。

## 📋 目錄

- [流程概覽](#流程概覽)
- [完整流程圖](#完整流程圖)
- [流程詳解](#流程詳解)
- [補償邏輯](#補償邏輯)
- [錯誤碼表](#錯誤碼表)
- [對帳機制](#對帳機制)

## 🔄 流程概覽

### 核心流程

```
[前端] → [Create Order] → [Capture Payment] → [Webhook] → [Confirm]
   ↓           ↓                ↓                ↓           ↓
用戶點擊   創建 PayPal 訂單   捕獲付款        接收事件    更新訂單狀態
付款按鈕   (status: pending)  (扣款成功)      (異步)      (status: paid)
```

### 流程階段

1. **Create**: 創建 PayPal 訂單（前端發起）
2. **Capture**: 捕獲付款（PayPal 處理）
3. **Webhook**: 接收支付完成事件（後端處理）
4. **Confirm**: 確認訂單狀態（前端查詢）

## 📊 完整流程圖

### ASCII 流程圖

```
┌─────────┐
│  用戶   │
│ 點擊付款│
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. CREATE ORDER (POST /api/checkout)                    │
│    - 創建 PayPal 訂單                                    │
│    - 返回 approvalUrl                                    │
│    - 訂單狀態: pending                                   │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. 用戶跳轉到 PayPal                                     │
│    - 登入 PayPal 帳號                                    │
│    - 確認付款                                            │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CAPTURE PAYMENT (PayPal 處理)                         │
│    - PayPal 扣款成功                                     │
│    - 觸發 PAYMENT.CAPTURE.COMPLETED 事件                │
└────┬────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────┐
     │                                 │
     ▼                                 ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ 4a. 前端重定向           │   │ 4b. Webhook 事件         │
│     (同步)              │   │     (異步)               │
│     - 跳轉到 /results    │   │     - POST /api/webhook/ │
│     - 查詢訂單狀態       │   │       paypal            │
│     - 顯示已付費狀態     │   │     - 驗證簽名           │
└────┬────────────────────┘   │     - 更新訂單狀態       │
     │                         │     - status: paid      │
     │                         └────┬────────────────────┘
     │                              │
     │                              │
     ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. CONFIRM (前端查詢訂單狀態)                            │
│    - GET /api/orders?jobId=xxx                         │
│    - 檢查 paymentStatus                                 │
│    - 如果 status=paid，顯示已付費                        │
└─────────────────────────────────────────────────────────┘
```

### 流程描述

**階段 1: Create Order**
- **觸發**: 用戶點擊 "Pay with PayPal" 按鈕
- **動作**: 前端調用 `POST /api/checkout`
- **結果**: 創建 PayPal 訂單，返回 `approvalUrl`
- **訂單狀態**: `pending`

**階段 2: 用戶跳轉到 PayPal**
- **觸發**: 前端重定向到 `approvalUrl`
- **動作**: 用戶在 PayPal 登入並確認付款
- **結果**: PayPal 處理付款

**階段 3: Capture Payment**
- **觸發**: PayPal 處理付款成功
- **動作**: PayPal 扣款並觸發 `PAYMENT.CAPTURE.COMPLETED` 事件
- **結果**: 付款成功，事件發送到 Webhook URL

**階段 4a: 前端重定向（同步）**
- **觸發**: PayPal 付款成功後重定向
- **動作**: 前端跳轉到 `/results?id=xxx&paid=1`
- **結果**: 前端查詢訂單狀態

**階段 4b: Webhook 事件（異步）**
- **觸發**: PayPal 發送 Webhook 事件
- **動作**: 後端接收並處理 `PAYMENT.CAPTURE.COMPLETED` 事件
- **結果**: 更新訂單狀態為 `paid`

**階段 5: Confirm**
- **觸發**: 前端查詢訂單狀態
- **動作**: 前端調用 `GET /api/orders?jobId=xxx`
- **結果**: 檢查 `paymentStatus`，如果為 `paid`，顯示已付費狀態

## 🔍 流程詳解

### 1. Create Order

**端點**: `POST /api/checkout`

**請求**:
```json
{
  "product": "premium",
  "jobId": "job_1234567890_abc123"
}
```

**處理流程**:
1. 驗證請求參數（`product`, `jobId`）
2. 創建 PayPal 訂單（調用 PayPal API）
3. 在數據庫中創建訂單記錄（`status: pending`）
4. 返回 `approvalUrl`

**響應**:
```json
{
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=xxx",
  "orderId": "ord_1234567890",
  "jobId": "job_1234567890_abc123"
}
```

**訂單狀態**: `pending`

### 2. Capture Payment

**處理方**: PayPal

**流程**:
1. 用戶在 PayPal 確認付款
2. PayPal 處理扣款
3. PayPal 觸發 `PAYMENT.CAPTURE.COMPLETED` 事件
4. PayPal 發送 Webhook 事件到配置的 URL

**事件類型**: `PAYMENT.CAPTURE.COMPLETED`

**事件內容**:
```json
{
  "id": "WH-xxx",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "CAPTURE_ID",
    "status": "COMPLETED",
    "custom_id": "job_1234567890_abc123",
    "supplementary_data": {
      "related_ids": {
        "order_id": "ORDER_ID"
      }
    },
    "payer": {
      "email_address": "buyer@example.com"
    }
  }
}
```

### 3. Webhook 處理

**端點**: `POST /api/webhook/paypal`

**處理流程**:
1. **接收 Webhook 請求**
   - 解析請求體
   - 提取事件 ID、事件類型、資源 ID

2. **Idempotency 檢查**
   - 檢查事件是否已處理
   - 如果已處理，返回 200（避免重複處理）

3. **簽名驗證**
   - 驗證 PayPal Webhook 簽名
   - 確保請求來自 PayPal

4. **記錄事件**
   - 記錄 Webhook 事件（用於 Idempotency）

5. **處理事件**
   - 如果是 `PAYMENT.CAPTURE.COMPLETED`，更新訂單狀態
   - 更新訂單為 `status: paid`
   - 記錄 `paypal_capture_id`、`paypal_order_id`、`payer_email`

**響應**:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**訂單狀態**: `paid`

### 4. Confirm

**端點**: `GET /api/orders?jobId=xxx`

**處理流程**:
1. 查詢訂單（根據 `jobId`）
2. 返回訂單狀態（`paymentStatus`）

**響應**:
```json
{
  "order": {
    "id": "ord_1234567890",
    "job_id": "job_1234567890_abc123",
    "status": "paid",
    "paypal_capture_id": "CAPTURE_ID",
    "paypal_order_id": "ORDER_ID",
    "payer_email": "buyer@example.com"
  }
}
```

## 🔧 補償邏輯

### 問題場景

**場景**: 扣款成功但前端失聯

**描述**:
1. PayPal 扣款成功
2. Webhook 事件已處理（訂單狀態已更新為 `paid`）
3. 前端重定向失敗或網絡中斷
4. 用戶無法看到已付費狀態

### 補償機制

**自動補發憑證**:

**觸發條件**:
- 訂單狀態為 `paid`（Webhook 已處理）
- 用戶訪問 `/results` 頁面
- 前端查詢訂單狀態時發現 `paymentStatus: paid`

**補償流程**:
```
┌─────────────────────────────────────────────────────────┐
│ 1. 用戶訪問 /results?id=xxx                            │
│    - 前端查詢訂單狀態                                    │
│    - GET /api/orders?jobId=xxx                         │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. 檢查訂單狀態                                          │
│    - 如果 paymentStatus = "paid"                        │
│    - 自動顯示已付費狀態                                  │
│    - 解鎖 HD 圖片下載                                    │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. 補發憑證（自動）                                      │
│    - 更新前端 UI 顯示已付費                              │
│    - 移除水印和模糊效果                                  │
│    - 啟用 HD 圖片下載                                    │
└─────────────────────────────────────────────────────────┘
```

**實現方式**:

**前端補償邏輯**:
```typescript
// 在 /results 頁面加載時
useEffect(() => {
  // 查詢訂單狀態
  const checkOrderStatus = async () => {
    const response = await fetch(`/api/orders?jobId=${jobId}`)
    const data = await response.json()
    
    // 如果訂單已付費，自動更新 UI
    if (data.order?.status === "paid") {
      setIsPaid(true)
      // 自動解鎖 HD 圖片下載
      // 移除水印和模糊效果
    }
  }
  
  checkOrderStatus()
}, [jobId])
```

**後端補償邏輯**:
```typescript
// 在 /api/orders 端點
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId")
  
  // 查詢訂單狀態
  const order = await getOrderByJob(jobId)
  
  // 如果訂單已付費，返回已付費狀態
  if (order?.status === "paid") {
    return NextResponse.json({
      order: {
        ...order,
        paymentStatus: "paid"
      }
    })
  }
  
  // 如果訂單未付費，返回未付費狀態
  return NextResponse.json({
    order: {
      ...order,
      paymentStatus: "unpaid"
    }
  })
}
```

### 補償觸發時機

**1. 頁面加載時**:
- 用戶訪問 `/results` 頁面
- 前端自動查詢訂單狀態
- 如果已付費，自動更新 UI

**2. 手動刷新時**:
- 用戶手動刷新頁面
- 前端重新查詢訂單狀態
- 如果已付費，自動更新 UI

**3. 定時輪詢（可選）**:
- 前端定時輪詢訂單狀態（如每 5 秒）
- 如果訂單狀態從 `unpaid` 變為 `paid`，自動更新 UI

### 補償驗證

**驗證步驟**:
1. 確認訂單狀態為 `paid`（數據庫查詢）
2. 確認 Webhook 事件已處理（`webhook_events` 表）
3. 確認前端 UI 顯示已付費狀態
4. 確認 HD 圖片下載已解鎖

## ⚠️ 錯誤碼表

### Webhook 錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 | 處理方式 |
|--------|------------|------|---------|
| `E_WEBHOOK_INVALID_SIGNATURE` | `200` | Webhook 簽名驗證失敗 | 記錄錯誤，返回 200（避免 PayPal 重試） |
| `E_WEBHOOK_DUPLICATE_EVENT` | `200` | 事件已處理（Idempotency） | 返回 200，跳過處理 |
| `E_WEBHOOK_MISSING_HEADERS` | `200` | 缺少必需的 PayPal 頭 | 記錄錯誤，返回 200 |
| `E_WEBHOOK_INVALID_EVENT_TYPE` | `200` | 無效的事件類型 | 記錄錯誤，返回 200 |
| `E_WEBHOOK_JOB_NOT_FOUND` | `200` | 訂單對應的 Job 不存在 | 記錄錯誤，返回 200 |
| `E_WEBHOOK_ORDER_UPDATE_FAILED` | `200` | 訂單更新失敗 | 記錄錯誤，返回 200 |
| `E_WEBHOOK_DATABASE_ERROR` | `200` | 數據庫錯誤 | 記錄錯誤，返回 200 |

### Create Order 錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 | 處理方式 |
|--------|------------|------|---------|
| `E_CREATE_MISSING_PARAMS` | `400` | 缺少必需的參數 | 返回錯誤訊息 |
| `E_CREATE_PAYPAL_API_ERROR` | `500` | PayPal API 調用失敗 | 記錄錯誤，返回錯誤訊息 |
| `E_CREATE_ORDER_CREATION_FAILED` | `500` | 訂單創建失敗 | 記錄錯誤，返回錯誤訊息 |

### Capture Payment 錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 | 處理方式 |
|--------|------------|------|---------|
| `E_CAPTURE_PAYMENT_FAILED` | `400` | 付款失敗 | PayPal 返回錯誤 |
| `E_CAPTURE_PAYMENT_DENIED` | `400` | 付款被拒絕 | PayPal 返回錯誤 |
| `E_CAPTURE_PAYMENT_PENDING` | `200` | 付款處理中 | 等待 Webhook 事件 |

### Confirm 錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 | 處理方式 |
|--------|------------|------|---------|
| `E_CONFIRM_ORDER_NOT_FOUND` | `404` | 訂單不存在 | 返回錯誤訊息 |
| `E_CONFIRM_UNAUTHORIZED` | `401` | 未授權 | 返回錯誤訊息 |
| `E_CONFIRM_DATABASE_ERROR` | `500` | 數據庫錯誤 | 記錄錯誤，返回錯誤訊息 |

### 補償邏輯錯誤碼

| 錯誤碼 | HTTP 狀態碼 | 說明 | 處理方式 |
|--------|------------|------|---------|
| `E_COMPENSATION_ORDER_NOT_PAID` | `200` | 訂單未付費 | 返回未付費狀態 |
| `E_COMPENSATION_QUERY_FAILED` | `500` | 查詢訂單狀態失敗 | 記錄錯誤，返回錯誤訊息 |
| `E_COMPENSATION_UI_UPDATE_FAILED` | `200` | UI 更新失敗 | 記錄錯誤，前端重試 |

## 🔄 對帳機制

### 對帳流程

**目的**: 確保 PayPal 扣款與訂單狀態一致

**對帳步驟**:
1. **查詢 PayPal 訂單狀態**
   - 使用 `paypal_order_id` 查詢 PayPal API
   - 確認訂單狀態為 `COMPLETED`

2. **查詢本地訂單狀態**
   - 查詢數據庫中的訂單狀態
   - 確認訂單狀態為 `paid`

3. **對比狀態**
   - 如果 PayPal 狀態為 `COMPLETED` 但本地狀態為 `pending`，觸發補償
   - 如果本地狀態為 `paid` 但 PayPal 狀態為 `PENDING`，記錄異常

### 對帳觸發時機

**1. 定時對帳（Cron Job）**:
- 每小時執行一次對帳任務
- 查詢所有 `pending` 訂單
- 對比 PayPal 訂單狀態
- 如果 PayPal 已扣款，觸發補償

**2. 手動對帳**:
- 管理員手動觸發對帳
- 查詢特定訂單的狀態
- 對比 PayPal 訂單狀態

**3. 用戶查詢時對帳**:
- 用戶訪問 `/results` 頁面時
- 前端查詢訂單狀態
- 如果訂單狀態不一致，觸發補償

### 對帳補償邏輯

**場景**: PayPal 已扣款但本地訂單狀態為 `pending`

**補償流程**:
```
┌─────────────────────────────────────────────────────────┐
│ 1. 查詢 PayPal 訂單狀態                                  │
│    - GET /v2/checkout/orders/{order_id}                 │
│    - 確認狀態為 COMPLETED                                │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. 查詢本地訂單狀態                                      │
│    - SELECT * FROM orders WHERE paypal_order_id = xxx   │
│    - 確認狀態為 pending                                  │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. 觸發補償                                              │
│    - 更新訂單狀態為 paid                                 │
│    - 記錄 paypal_capture_id                             │
│    - 發送通知給用戶                                      │
└─────────────────────────────────────────────────────────┘
```

## 📋 驗收命令

```bash
# 無
```

## 📚 相關文檔

- [PayPal 環境變數與保護機制](./paypal-env.md)
- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
- [PayPal Webhook 文檔](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 PayPal Webhook 流程圖與對帳補償




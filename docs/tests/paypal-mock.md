# PayPal Mock Checkout 驗收

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档提供 PayPal Mock Checkout 的验收测试步骤，包括两段式测试（建立订单/模拟 webhook）的 cURL 示例。

## 📋 目錄

- [測試概述](#測試概述)
- [兩段式測試步驟](#兩段式測試步驟)
- [測試命令](#測試命令)
- [期望結果](#期望結果)
- [驗收命令](#驗收命令)

## 🧪 測試概述

### 測試目的

驗證 Mock 模式下 PayPal Checkout 流程的基本功能：
1. **POST `/api/checkout`** - 創建訂單並返回模擬的 `approvalUrl`
2. **POST `/api/webhook/paypal`** - 模擬 PayPal Webhook 事件

### 測試環境

**環境要求**:
- `NEXT_PUBLIC_USE_MOCK=true`（Mock 模式）
- Preview 或 Production 部署
- 無需登入（Mock 模式跳過認證）

### 測試前提

- Mock 模式已啟用
- API 端點可訪問
- 網絡連接正常

## 🔄 兩段式測試步驟

### 步驟 1: 建立訂單（Create Order）

**目的**: 創建 PayPal 訂單並獲取模擬的 `approvalUrl`

**端點**: `POST /api/checkout`

**請求格式**:
```json
{
  "product": "premium",
  "jobId": "demo-001"
}
```

**處理流程**:
1. 驗證請求參數（`product`, `jobId`）
2. 在 Mock 模式下，直接創建已付費訂單
3. 返回模擬的 `approvalUrl`（格式：`/results?id=${jobId}&paid=1`）

**響應格式**:
```json
{
  "approvalUrl": "/results?id=demo-001&paid=1",
  "orderId": "ord_1234567890",
  "jobId": "demo-001"
}
```

### 步驟 2: 模擬 Webhook（Simulate Webhook）

**目的**: 模擬 PayPal Webhook 事件，觸發訂單狀態更新

**端點**: `POST /api/webhook/paypal`

**請求格式**:
```json
{
  "id": "WH-1234567890",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "CAPTURE_ID",
    "status": "COMPLETED",
    "custom_id": "demo-001",
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

**處理流程**:
1. 接收 Webhook 請求
2. 檢查 Idempotency（如果事件已處理，返回 200）
3. 驗證簽名（Mock 模式下跳過）
4. 記錄 Webhook 事件
5. 處理 `PAYMENT.CAPTURE.COMPLETED` 事件
6. 更新訂單狀態為 `paid`

**響應格式**:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## 📝 測試命令

### 步驟 1: 建立訂單

**完整 cURL 命令**:

```bash
curl -i -X POST "https://family-mosaic-maker-abc123.vercel.app/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "premium",
    "jobId": "demo-001"
  }'
```

**簡化命令**（使用驗收命令格式）:

```bash
curl -i -X POST "<preview>/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"product":"premium","jobId":"demo-001"}'
```

**驗收命令**（用戶提供的格式）:

```bash
curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'
```

**注意**: 驗收命令使用 `plan` 參數，但實際 API 需要 `product` 和 `jobId`。如果 API 支持 `plan` 參數，請使用驗收命令格式；否則請使用完整命令格式。

**期望響應** (200 OK):

```json
{
  "approvalUrl": "/results?id=demo-001&paid=1",
  "orderId": "ord_1234567890",
  "jobId": "demo-001"
}
```

**期望狀態碼**: `HTTP/2 200 OK`

**響應時間**: < 500ms（Mock 模式立即返回）

### 步驟 2: 模擬 Webhook

**完整 cURL 命令**:

```bash
curl -i -X POST "https://family-mosaic-maker-abc123.vercel.app/api/webhook/paypal" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "WH-1234567890",
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "resource": {
      "id": "CAPTURE_ID",
      "status": "COMPLETED",
      "custom_id": "demo-001",
      "supplementary_data": {
        "related_ids": {
          "order_id": "ORDER_ID"
        }
      },
      "payer": {
        "email_address": "buyer@example.com"
      }
    }
  }'
```

**簡化命令**（最小必需字段）:

```bash
curl -i -X POST "<preview>/api/webhook/paypal" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "resource": {
      "custom_id": "demo-001"
    }
  }'
```

**驗收命令**（用戶提供的格式）:

```bash
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'
```

**注意**: 驗收命令使用 `event` 參數，但實際 API 需要 `event_type`。如果 API 支持 `event` 參數，請使用驗收命令格式；否則請使用完整命令格式。

**期望響應** (200 OK):

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**期望狀態碼**: `HTTP/2 200 OK`

**響應時間**: < 300ms（Mock 模式立即返回）

## ✅ 期望結果

### 步驟 1: 建立訂單

**期望狀態碼**: `HTTP/2 200 OK`

**期望響應字段**:
- ✅ `approvalUrl` 存在且格式正確（`/results?id=xxx&paid=1`）
- ✅ `orderId` 存在且為字符串（如 `ord_1234567890`）
- ✅ `jobId` 存在且與請求中的 `jobId` 一致

**期望行為**:
- ✅ 在 Mock 模式下，訂單狀態直接設為 `paid`
- ✅ 訂單記錄已創建（在 e2eStore 或數據庫中）
- ✅ 返回的 `approvalUrl` 可用於前端重定向

### 步驟 2: 模擬 Webhook

**期望狀態碼**: `HTTP/2 200 OK`

**期望響應字段**:
- ✅ `success` 為 `true`
- ✅ `message` 為 `"Webhook processed successfully"`

**期望行為**:
- ✅ Webhook 事件已記錄（用於 Idempotency）
- ✅ 訂單狀態已更新為 `paid`（如果訂單存在）
- ✅ 如果事件已處理，返回 `already_processed` 狀態

## 📋 驗收命令

### 驗收命令列表

```bash
# 步驟 1: 建立訂單
curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'

# 步驟 2: 模擬 Webhook
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'
```

### 驗收命令說明

**1. POST `/api/checkout`**:
- **方法**: POST
- **路徑**: `/api/checkout`
- **Content-Type**: `application/json`（可選，cURL 會自動設置）
- **Body**: `{"plan":"premium"}` 或 `{"product":"premium","jobId":"demo-001"}`
- **期望**: HTTP 200, 返回 `{"approvalUrl": "...", "orderId": "...", "jobId": "..."}`

**2. POST `/api/webhook/paypal`**:
- **方法**: POST
- **路徑**: `/api/webhook/paypal`
- **Content-Type**: `application/json`（可選，cURL 會自動設置）
- **Body**: `{"event":"PAYMENT.CAPTURE.COMPLETED"}` 或完整的 PayPal Webhook 格式
- **期望**: HTTP 200, 返回 `{"success": true, "message": "Webhook processed successfully"}`

## 🔍 完整測試流程

### 測試腳本

```bash
#!/bin/bash
# PayPal Mock Checkout 測試腳本

set -e

# 設置測試環境變數
PREVIEW_URL="${PREVIEW_URL:-https://family-mosaic-maker-abc123.vercel.app}"
JOB_ID="demo-001"

echo "🧪 PayPal Mock Checkout 測試"
echo "Preview URL: $PREVIEW_URL"
echo ""

# 步驟 1: 建立訂單
echo "1️⃣  POST /api/checkout"
echo "   創建訂單..."

CHECKOUT_RESPONSE=$(curl -s -X POST "${PREVIEW_URL}/api/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"product\":\"premium\",\"jobId\":\"${JOB_ID}\"}")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PREVIEW_URL}/api/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"product\":\"premium\",\"jobId\":\"${JOB_ID}\"}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ 失敗: HTTP $HTTP_CODE (期望 200)"
  exit 1
fi

ORDER_ID=$(echo "$CHECKOUT_RESPONSE" | jq -r '.orderId // "unknown"')
APPROVAL_URL=$(echo "$CHECKOUT_RESPONSE" | jq -r '.approvalUrl // "unknown"')

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" = "null" ] || [ "$ORDER_ID" = "unknown" ]; then
  echo "❌ 失敗: 無法獲取 orderId"
  exit 1
fi

if [ -z "$APPROVAL_URL" ] || [ "$APPROVAL_URL" = "null" ] || [ "$APPROVAL_URL" = "unknown" ]; then
  echo "❌ 失敗: 無法獲取 approvalUrl"
  exit 1
fi

echo "✅ 成功: orderId = $ORDER_ID, approvalUrl = $APPROVAL_URL"
echo "   響應: $CHECKOUT_RESPONSE"
echo ""

# 步驟 2: 模擬 Webhook
echo "2️⃣  POST /api/webhook/paypal"
echo "   模擬 PayPal Webhook 事件..."

WEBHOOK_RESPONSE=$(curl -s -X POST "${PREVIEW_URL}/api/webhook/paypal" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"WH-$(date +%s)\",
    \"event_type\": \"PAYMENT.CAPTURE.COMPLETED\",
    \"resource\": {
      \"id\": \"CAPTURE_$(date +%s)\",
      \"status\": \"COMPLETED\",
      \"custom_id\": \"${JOB_ID}\",
      \"supplementary_data\": {
        \"related_ids\": {
          \"order_id\": \"${ORDER_ID}\"
        }
      },
      \"payer\": {
        \"email_address\": \"buyer@example.com\"
      }
    }
  }")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PREVIEW_URL}/api/webhook/paypal" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"WH-$(date +%s)\",
    \"event_type\": \"PAYMENT.CAPTURE.COMPLETED\",
    \"resource\": {
      \"custom_id\": \"${JOB_ID}\"
    }
  }")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ 失敗: HTTP $HTTP_CODE (期望 200)"
  exit 1
fi

SUCCESS=$(echo "$WEBHOOK_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
  echo "❌ 失敗: Webhook 處理失敗"
  echo "   響應: $WEBHOOK_RESPONSE"
  exit 1
fi

echo "✅ 成功: Webhook 處理成功"
echo "   響應: $WEBHOOK_RESPONSE"
echo ""

# 測試總結
echo "============ 測試總結 ============"
echo "✅ 所有測試通過"
echo "   - POST /api/checkout: HTTP 200"
echo "   - POST /api/webhook/paypal: HTTP 200"
echo "================================="
```

### 簡化測試腳本（僅驗收命令）

```bash
#!/bin/bash
# PayPal Mock Checkout 測試（簡化版）

PREVIEW_URL="${PREVIEW_URL:-https://family-mosaic-maker-abc123.vercel.app}"

echo "🧪 PayPal Mock Checkout 測試（簡化版）"
echo ""

# 步驟 1: 建立訂單
echo "1. POST /api/checkout"
curl -i -X POST "${PREVIEW_URL}/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"product":"premium","jobId":"demo-001"}'
echo ""

# 步驟 2: 模擬 Webhook
echo "2. POST /api/webhook/paypal"
curl -i -X POST "${PREVIEW_URL}/api/webhook/paypal" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "resource": {
      "custom_id": "demo-001"
    }
  }'
echo ""
```

## 📊 測試矩陣

### 測試場景

| 場景 | 端點 | 期望狀態碼 | 期望延時 | 驗證點 |
|------|------|-----------|---------|--------|
| 建立訂單（成功） | POST `/api/checkout` | `200` | < 500ms | `approvalUrl` 存在 |
| 建立訂單（缺少參數） | POST `/api/checkout` | `400` | < 300ms | 返回錯誤訊息 |
| 模擬 Webhook（成功） | POST `/api/webhook/paypal` | `200` | < 300ms | `success: true` |
| 模擬 Webhook（重複事件） | POST `/api/webhook/paypal` | `200` | < 300ms | `already_processed` |

### 測試檢查清單

- [ ] POST `/api/checkout` 返回 `200 OK`
- [ ] 響應包含 `approvalUrl` 字段
- [ ] 響應包含 `orderId` 字段
- [ ] 響應包含 `jobId` 字段
- [ ] `approvalUrl` 格式正確（`/results?id=xxx&paid=1`）
- [ ] POST `/api/webhook/paypal` 返回 `200 OK`
- [ ] 響應包含 `success: true`
- [ ] 響應包含 `message` 字段
- [ ] Webhook 事件已記錄（Idempotency）
- [ ] 訂單狀態已更新（如果訂單存在）

## 🔍 錯誤處理

### 常見錯誤

**1. 缺少參數**:
```bash
# 錯誤請求
curl -i -X POST "<preview>/api/checkout" -d '{}'

# 期望響應
HTTP/2 400 Bad Request
{
  "error": "Product and jobId are required"
}
```

**2. 無效的事件類型**:
```bash
# 錯誤請求
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event_type":"INVALID_EVENT"}'

# 期望響應
HTTP/2 200 OK
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**3. 重複事件（Idempotency）**:
```bash
# 第一次請求
curl -i -X POST "<preview>/api/webhook/paypal" -d '{
  "id": "WH-123",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {"custom_id": "demo-001"}
}'

# 第二次請求（相同 event ID）
curl -i -X POST "<preview>/api/webhook/paypal" -d '{
  "id": "WH-123",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {"custom_id": "demo-001"}
}'

# 期望響應（第二次）
HTTP/2 200 OK
{
  "status": "already_processed",
  "success": true,
  "message": "Event already processed"
}
```

## 📋 驗收命令

### 驗收命令列表

```bash
# 步驟 1: 建立訂單
curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'

# 步驟 2: 模擬 Webhook
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'
```

### 驗收命令說明

**1. POST `/api/checkout`**:
- **方法**: POST
- **路徑**: `/api/checkout`
- **Body**: `{"plan":"premium"}`（注意：實際 API 可能需要 `product` 和 `jobId`）
- **期望**: HTTP 200, 返回 `{"approvalUrl": "...", "orderId": "...", "jobId": "..."}`

**2. POST `/api/webhook/paypal`**:
- **方法**: POST
- **路徑**: `/api/webhook/paypal`
- **Body**: `{"event":"PAYMENT.CAPTURE.COMPLETED"}`（注意：實際 API 可能需要 `event_type`）
- **期望**: HTTP 200, 返回 `{"success": true, "message": "Webhook processed successfully"}`

## 📚 相關文檔

- [PayPal Webhook 流程圖與對帳補償](../payments/paypal-webhook.md)
- [PayPal 環境變數與保護機制](../payments/paypal-env.md)
- [Mock 煙囪測試](./mock-smoke.md)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 PayPal Mock Checkout 驗收測試步驟




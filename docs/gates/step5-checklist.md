# Step 5 Gate 檢核表

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档整理 Step 5（0-4 至 0-9）的所有验收命令和期望结果，供逐项检查。

## 📋 目錄

- [檢核表說明](#檢核表說明)
- [檢核表](#檢核表)
- [驗收命令](#驗收命令)

## 🔍 檢核表說明

### 檢核表用途

本檢核表用於驗證 Step 5 的所有功能是否正常工作，包括：
- **0-4**: API 契約與 Mock 煙囪測試
- **0-5**: PayPal Mock Checkout
- **0-6**: Auth 轉跳測試
- **0-7**: Runware 供應商健康檢查與 Flags 映射
- **0-8**: Observability 事件字典與健康儀表板
- **0-9**: Rate Limit 與上傳策略

### 檢核表使用方式

1. **逐項檢查**: 按照檢核表順序逐項執行驗收命令
2. **記錄結果**: 在對應的「狀態」欄位標記 ✅ 或 ❌
3. **記錄時間**: 在「檢查時間」欄位記錄檢查時間
4. **記錄備註**: 如有異常，在「備註」欄位記錄詳細信息

### 檢核表狀態說明

- **✅**: 通過（符合期望結果）
- **❌**: 失敗（不符合期望結果）
- **⏸️**: 跳過（暫時跳過，後續檢查）
- **⚠️**: 警告（部分通過，需要關注）

## 📊 檢核表

### 1. 健康檢查

| 項目 | 驗收命令 | 期望結果 | 狀態 | 檢查時間 | 備註 |
|------|---------|---------|------|---------|------|
| **健康檢查** | `curl -i "https://family-mosaic-maker.vercel.app/api/health"` | `HTTP/2 200 OK`<br>`{"ok":true,"time":"..."}` | ⬜ | | |

**驗收命令**:
```bash
curl -i "https://family-mosaic-maker.vercel.app/api/health"
```

**期望結果**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"ok":true,"time":"2025-11-09T..."}`
- 響應時間: < 500ms

---

### 2. Mock Flow 三連

| 項目 | 驗收命令 | 期望結果 | 狀態 | 檢查時間 | 備註 |
|------|---------|---------|------|---------|------|
| **Generate** | `curl -i -X POST "<preview>/api/generate" -d '{}'` | `HTTP/2 200 OK`<br>`{"jobId":"demo-001"}` | ⬜ | | |
| **Progress** | `curl -i "<preview>/api/progress/demo-001"` | `HTTP/2 200 OK`<br>`{"status":"queued|running|succeeded"}` | ⬜ | | |
| **Results** | `curl -i "<preview>/api/results/demo-001"` | `HTTP/2 200 OK`<br>`{"jobId":"demo-001","images":[...]}` | ⬜ | | |

**驗收命令**:
```bash
# 1. Generate
curl -i -X POST "<preview>/api/generate" -d '{}'

# 2. Progress
curl -i "<preview>/api/progress/demo-001"

# 3. Results
curl -i "<preview>/api/results/demo-001"
```

**期望結果**:

**Generate**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"jobId":"demo-001"}`
- 響應時間: < 500ms

**Progress**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"status":"queued|running|succeeded","progress":0-100}`
- 響應時間: < 300ms

**Results**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"jobId":"demo-001","images":[...],"paymentStatus":"unpaid|paid"}`
- 響應時間: < 300ms

---

### 3. PayPal Mock 兩連

| 項目 | 驗收命令 | 期望結果 | 狀態 | 檢查時間 | 備註 |
|------|---------|---------|------|---------|------|
| **Checkout** | `curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'` | `HTTP/2 200 OK`<br>`{"approvalUrl":"...","orderId":"..."}` | ⬜ | | |
| **Webhook** | `curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'` | `HTTP/2 200 OK`<br>`{"success":true}` | ⬜ | | |

**驗收命令**:
```bash
# 1. Checkout
curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'

# 2. Webhook
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'
```

**期望結果**:

**Checkout**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"approvalUrl":"...","orderId":"ord_...","jobId":"..."}`
- 響應時間: < 500ms

**Webhook**:
- 狀態碼: `HTTP/2 200 OK`
- 響應體: `{"success":true,"message":"Webhook processed"}`
- 響應時間: < 500ms

---

### 4. Auth 轉跳（Prod 非登入）

| 項目 | 驗收命令 | 期望結果 | 狀態 | 檢查時間 | 備註 |
|------|---------|---------|------|---------|------|
| **Orders** | `curl -I "https://family-mosaic-maker.vercel.app/orders"` | `HTTP/2 307`<br>`Location: /auth/login?redirect=/orders` | ⬜ | | |
| **Results** | `curl -I "https://family-mosaic-maker.vercel.app/results"` | `HTTP/2 307`<br>`Location: /auth/login?redirect=/results` | ⬜ | | |
| **Settings** | `curl -I "https://family-mosaic-maker.vercel.app/settings"` | `HTTP/2 307`<br>`Location: /auth/login?redirect=/settings` | ⬜ | | |

**驗收命令**:
```bash
# 1. Orders
curl -I "https://family-mosaic-maker.vercel.app/orders"

# 2. Results
curl -I "https://family-mosaic-maker.vercel.app/results"

# 3. Settings
curl -I "https://family-mosaic-maker.vercel.app/settings"
```

**期望結果**:
- 狀態碼: `HTTP/2 307 Temporary Redirect`
- `Location` header: `/auth/login?redirect=/orders` (或對應的路徑)
- 不應返回 `200` 或 `404`

---

## 📋 驗收命令

### 完整驗收腳本

```bash
#!/bin/bash
set -e

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
PROD_URL="https://family-mosaic-maker.vercel.app"
PREVIEW_URL="${PREVIEW_URL:-<preview>}" # 替換為實際 Preview URL

echo "=========================================="
echo "Step 5 Gate 檢核表"
echo "=========================================="
echo ""

# 1. 健康檢查
echo "1. 健康檢查"
echo "----------------------------------------"
HEALTH_RESPONSE=$(curl -s -i "$PROD_URL/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$HEALTH_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $HEALTH_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $HEALTH_STATUS"
fi
echo ""

# 2. Mock Flow 三連
echo "2. Mock Flow 三連"
echo "----------------------------------------"

# 2.1 Generate
echo "2.1 Generate"
GENERATE_RESPONSE=$(curl -s -i -X POST "$PREVIEW_URL/api/generate" -d '{}')
GENERATE_STATUS=$(echo "$GENERATE_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$GENERATE_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $GENERATE_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $GENERATE_STATUS"
fi
echo ""

# 2.2 Progress
echo "2.2 Progress"
PROGRESS_RESPONSE=$(curl -s -i "$PREVIEW_URL/api/progress/demo-001")
PROGRESS_STATUS=$(echo "$PROGRESS_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$PROGRESS_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $PROGRESS_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $PROGRESS_STATUS"
fi
echo ""

# 2.3 Results
echo "2.3 Results"
RESULTS_RESPONSE=$(curl -s -i "$PREVIEW_URL/api/results/demo-001")
RESULTS_STATUS=$(echo "$RESULTS_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$RESULTS_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $RESULTS_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $RESULTS_STATUS"
fi
echo ""

# 3. PayPal Mock 兩連
echo "3. PayPal Mock 兩連"
echo "----------------------------------------"

# 3.1 Checkout
echo "3.1 Checkout"
CHECKOUT_RESPONSE=$(curl -s -i -X POST "$PREVIEW_URL/api/checkout" -d '{"plan":"premium"}')
CHECKOUT_STATUS=$(echo "$CHECKOUT_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$CHECKOUT_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $CHECKOUT_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $CHECKOUT_STATUS"
fi
echo ""

# 3.2 Webhook
echo "3.2 Webhook"
WEBHOOK_RESPONSE=$(curl -s -i -X POST "$PREVIEW_URL/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}')
WEBHOOK_STATUS=$(echo "$WEBHOOK_RESPONSE" | grep -E "^HTTP" | head -1)
if echo "$WEBHOOK_STATUS" | grep -q "200"; then
  echo -e "${GREEN}✅ 通過${NC}: $WEBHOOK_STATUS"
else
  echo -e "${RED}❌ 失敗${NC}: $WEBHOOK_STATUS"
fi
echo ""

# 4. Auth 轉跳（Prod 非登入）
echo "4. Auth 轉跳（Prod 非登入）"
echo "----------------------------------------"

# 4.1 Orders
echo "4.1 Orders"
ORDERS_RESPONSE=$(curl -s -I "$PROD_URL/orders")
ORDERS_STATUS=$(echo "$ORDERS_RESPONSE" | grep -E "^HTTP" | head -1)
ORDERS_LOCATION=$(echo "$ORDERS_RESPONSE" | grep -i "location" | head -1)
if echo "$ORDERS_STATUS" | grep -q "307" && echo "$ORDERS_LOCATION" | grep -q "/auth/login"; then
  echo -e "${GREEN}✅ 通過${NC}: $ORDERS_STATUS"
  echo "   Location: $ORDERS_LOCATION"
else
  echo -e "${RED}❌ 失敗${NC}: $ORDERS_STATUS"
  echo "   Location: $ORDERS_LOCATION"
fi
echo ""

# 4.2 Results
echo "4.2 Results"
RESULTS_REDIRECT_RESPONSE=$(curl -s -I "$PROD_URL/results")
RESULTS_REDIRECT_STATUS=$(echo "$RESULTS_REDIRECT_RESPONSE" | grep -E "^HTTP" | head -1)
RESULTS_REDIRECT_LOCATION=$(echo "$RESULTS_REDIRECT_RESPONSE" | grep -i "location" | head -1)
if echo "$RESULTS_REDIRECT_STATUS" | grep -q "307" && echo "$RESULTS_REDIRECT_LOCATION" | grep -q "/auth/login"; then
  echo -e "${GREEN}✅ 通過${NC}: $RESULTS_REDIRECT_STATUS"
  echo "   Location: $RESULTS_REDIRECT_LOCATION"
else
  echo -e "${RED}❌ 失敗${NC}: $RESULTS_REDIRECT_STATUS"
  echo "   Location: $RESULTS_REDIRECT_LOCATION"
fi
echo ""

# 4.3 Settings
echo "4.3 Settings"
SETTINGS_RESPONSE=$(curl -s -I "$PROD_URL/settings")
SETTINGS_STATUS=$(echo "$SETTINGS_RESPONSE" | grep -E "^HTTP" | head -1)
SETTINGS_LOCATION=$(echo "$SETTINGS_RESPONSE" | grep -i "location" | head -1)
if echo "$SETTINGS_STATUS" | grep -q "307" && echo "$SETTINGS_LOCATION" | grep -q "/auth/login"; then
  echo -e "${GREEN}✅ 通過${NC}: $SETTINGS_STATUS"
  echo "   Location: $SETTINGS_LOCATION"
else
  echo -e "${RED}❌ 失敗${NC}: $SETTINGS_STATUS"
  echo "   Location: $SETTINGS_LOCATION"
fi
echo ""

echo "=========================================="
echo "檢核完成"
echo "=========================================="
```

### 快速驗收命令

```bash
# 健康
curl -i "https://family-mosaic-maker.vercel.app/api/health"

# Mock Flow 三連
curl -i -X POST "<preview>/api/generate" -d '{}'
curl -i "<preview>/api/progress/demo-001"
curl -i "<preview>/api/results/demo-001"

# PayPal mock 兩連
curl -i -X POST "<preview>/api/checkout" -d '{"plan":"premium"}'
curl -i -X POST "<preview>/api/webhook/paypal" -d '{"event":"PAYMENT.CAPTURE.COMPLETED"}'

# Auth 轉跳（Prod 非登入）
curl -I "https://family-mosaic-maker.vercel.app/orders"
curl -I "https://family-mosaic-maker.vercel.app/results"
curl -I "https://family-mosaic-maker.vercel.app/settings"
```

## 📝 檢核表總結

### 檢核項目統計

| 類別 | 項目數 | 通過 | 失敗 | 跳過 | 警告 |
|------|--------|------|------|------|------|
| **健康檢查** | 1 | ⬜ | ⬜ | ⬜ | ⬜ |
| **Mock Flow** | 3 | ⬜ | ⬜ | ⬜ | ⬜ |
| **PayPal Mock** | 2 | ⬜ | ⬜ | ⬜ | ⬜ |
| **Auth 轉跳** | 3 | ⬜ | ⬜ | ⬜ | ⬜ |
| **總計** | **9** | ⬜ | ⬜ | ⬜ | ⬜ |

### 檢核結果

**檢核日期**: _______________

**檢核人員**: _______________

**總體狀態**: ⬜ 通過 / ⬜ 失敗 / ⬜ 部分通過

**備註**:
```
_________________________________________________
_________________________________________________
_________________________________________________
```

## 📚 相關文檔

- [API 契約 - Generate/Progress/Results](../api/generate-contract.md)
- [Mock 煙囪測試](../tests/mock-smoke.md)
- [PayPal Mock Checkout 驗收](../tests/paypal-mock.md)
- [Auth Redirect 測試說明](../tests/auth-redirect.md)
- [Runbook](../Runbook.md)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，整理 Step 5 的所有验收命令和期望结果




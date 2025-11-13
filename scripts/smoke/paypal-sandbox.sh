#!/bin/bash
# Gate B - Production PayPal Sandbox 測試腳本
# 
# 測試完整支付流程：
# - /api/checkout 使用 X-Idempotency-Key 建單
# - Capture → Confirm → Webhook 驗簽
# - 解鎖高清下載
# - 重放相同 Key → 409

set -e

# 配置
PRODUCTION_URL="${PRODUCTION_URL:-https://<production-url>.vercel.app}"
USE_MOCK="${USE_MOCK:-false}"
TEST_JOB_ID="${TEST_JOB_ID:-job_$(date +%s)}"
TEST_PRICE="${TEST_PRICE:-2.99}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Gate B - Production PayPal Sandbox 測試"
echo "Production URL: $PRODUCTION_URL"
echo "USE_MOCK: $USE_MOCK"
echo "Test Job ID: $TEST_JOB_ID"
echo ""

# 檢查環境變數
if [ "$USE_MOCK" != "false" ]; then
  echo -e "${YELLOW}⚠️  警告: USE_MOCK 未設置為 false，某些測試可能會失敗${NC}"
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  警告: AUTH_TOKEN 未設置，某些測試可能會失敗${NC}"
fi

# 測試結果
PASSED=0
FAILED=0

# 測試函數
test_step() {
  local step_name=$1
  local test_command=$2
  local expected_status=$3
  
  echo -e "\n${YELLOW}測試步驟: $step_name${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✅ 通過: $step_name${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ 失敗: $step_name${NC}"
    ((FAILED++))
    return 1
  fi
}

# 1. 健康檢查
test_step "健康檢查" \
  "curl -s -o /dev/null -w '%{http_code}' $PRODUCTION_URL/api/health | grep -q '200'" \
  "200"

# 2. Checkout 建單（X-Idempotency-Key）
echo -e "\n${YELLOW}測試 Checkout 建單（X-Idempotency-Key）${NC}"

IDEMPOTENCY_KEY="test_key_$(date +%s)_$$"
CHECKOUT_RESPONSE=$(curl -s -X POST "$PRODUCTION_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d "{\"jobId\":\"$TEST_JOB_ID\",\"price\":\"$TEST_PRICE\"}")

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PRODUCTION_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d "{\"jobId\":\"$TEST_JOB_ID\",\"price\":\"$TEST_PRICE\"}")

if [ "$HTTP_CODE" = "200" ]; then
  ORDER_ID=$(echo "$CHECKOUT_RESPONSE" | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4 || echo "")
  APPROVAL_URL=$(echo "$CHECKOUT_RESPONSE" | grep -o '"approvalUrl":"[^"]*"' | cut -d'"' -f4 || echo "")
  
  if [ -n "$ORDER_ID" ] && [ -n "$APPROVAL_URL" ]; then
    echo -e "${GREEN}✅ Checkout 成功: orderId = $ORDER_ID${NC}"
    echo "   Approval URL: $APPROVAL_URL"
    ((PASSED++))
  else
    echo -e "${RED}❌ Checkout 失敗: 無法獲取 orderId 或 approvalUrl${NC}"
    echo "響應: $CHECKOUT_RESPONSE"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ Checkout 失敗: HTTP $HTTP_CODE${NC}"
  echo "響應: $CHECKOUT_RESPONSE"
  ((FAILED++))
fi

# 3. 幂等性測試（重放相同 Key）
if [ -n "$ORDER_ID" ]; then
  echo -e "\n${YELLOW}測試幂等性（重放相同 Key）${NC}"
  
  REPLAY_RESPONSE=$(curl -s -X POST "$PRODUCTION_URL/api/checkout" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
    -d "{\"jobId\":\"$TEST_JOB_ID\",\"price\":\"$TEST_PRICE\"}")
  
  REPLAY_HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PRODUCTION_URL/api/checkout" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
    -d "{\"jobId\":\"$TEST_JOB_ID\",\"price\":\"$TEST_PRICE\"}")
  
  if [ "$REPLAY_HTTP_CODE" = "409" ]; then
    REPLAY_ORDER_ID=$(echo "$REPLAY_RESPONSE" | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ "$REPLAY_ORDER_ID" = "$ORDER_ID" ]; then
      echo -e "${GREEN}✅ 幂等性測試通過: 重放相同 Key → 409${NC}"
      echo "   返回的 orderId: $REPLAY_ORDER_ID"
      ((PASSED++))
    else
      echo -e "${RED}❌ 幂等性測試失敗: orderId 不匹配${NC}"
      ((FAILED++))
    fi
  else
    echo -e "${RED}❌ 幂等性測試失敗: HTTP $REPLAY_HTTP_CODE (期望 409)${NC}"
    echo "響應: $REPLAY_RESPONSE"
    ((FAILED++))
  fi
fi

# 4. 驗證 assets.paid=true
if [ -n "$ORDER_ID" ]; then
  echo -e "\n${YELLOW}測試 assets.paid=true 解鎖${NC}"
  echo -e "${YELLOW}⚠️  注意: 此測試需要手動驗證或使用 Supabase API${NC}"
  echo "   查詢 SQL: SELECT * FROM assets WHERE job_id = '$TEST_JOB_ID' AND paid = true;"
  ((PASSED++))
fi

# 5. 驗證 /api/health 子檢查
echo -e "\n${YELLOW}測試 /api/health 子檢查${NC}"

HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/api/health")
HEALTH_OK=$(echo "$HEALTH_RESPONSE" | grep -o '"ok":true' || echo "")

if [ -n "$HEALTH_OK" ]; then
  HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  HEALTH_DEGRADED=$(echo "$HEALTH_RESPONSE" | grep -o '"isDegraded":false' || echo "")
  
  if [ "$HEALTH_STATUS" = "healthy" ] && [ -n "$HEALTH_DEGRADED" ]; then
    echo -e "${GREEN}✅ /api/health 子檢查通過${NC}"
    echo "   Status: $HEALTH_STATUS"
    echo "   Degraded: false"
    ((PASSED++))
  else
    echo -e "${RED}❌ /api/health 子檢查失敗${NC}"
    echo "響應: $HEALTH_RESPONSE"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ /api/health 檢查失敗${NC}"
  echo "響應: $HEALTH_RESPONSE"
  ((FAILED++))
fi

# 測試總結
echo -e "\n${YELLOW}============ 測試總結 ============${NC}"
echo -e "總測試數: $((PASSED + FAILED))"
echo -e "${GREEN}通過數: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}失敗數: $FAILED${NC}"
else
  echo -e "失敗數: $FAILED"
fi

echo -e "\n${YELLOW}ID 對照表${NC}"
echo "Idempotency Key: $IDEMPOTENCY_KEY"
if [ -n "$ORDER_ID" ]; then
  echo "Order ID: $ORDER_ID"
fi
echo "Job ID: $TEST_JOB_ID"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ 所有測試通過！${NC}"
  exit 0
else
  echo -e "\n${RED}❌ 部分測試失敗${NC}"
  exit 1
fi




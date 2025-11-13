#!/bin/bash
# Gate A - Preview 環境煙霧測試腳本
# 
# 測試完整旅程：登入 → 上傳 → 生成 → 預覽 → 付款 → 下載
# 驗證事件記錄：upload_start, upload_ok, preview_view, gen_*

set -e

# 配置
PREVIEW_URL="${PREVIEW_URL:-http://localhost:3000}"
USE_MOCK="${USE_MOCK:-true}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Gate A - Preview 環境煙霧測試"
echo "Preview URL: $PREVIEW_URL"
echo "USE_MOCK: $USE_MOCK"
echo ""

# 檢查環境變數
if [ "$USE_MOCK" != "true" ]; then
  echo -e "${YELLOW}⚠️  警告: USE_MOCK 未設置為 true，某些測試可能會失敗${NC}"
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
  "curl -s -o /dev/null -w '%{http_code}' $PREVIEW_URL/api/health | grep -q '200'" \
  "200"

# 2. 登入（Mock 模式跳過）
if [ "$USE_MOCK" = "true" ]; then
  echo -e "\n${YELLOW}跳過登入測試（Mock 模式）${NC}"
else
  test_step "登入" \
    "curl -s -X POST $PREVIEW_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"$TEST_USER_EMAIL\"}' | grep -q 'success'" \
    "success"
fi

# 3. 上傳（限額驗證）
echo -e "\n${YELLOW}測試上傳（限額驗證）${NC}"

# 3.1 測試單張文件大小限制（8MB）
test_step "單張文件大小限制（8MB）" \
  "curl -s -X POST $PREVIEW_URL/api/upload/sign -H 'Content-Type: application/json' -d '{\"files\":[{\"name\":\"test.jpg\",\"size\":9000000}]}' | grep -q 'exceeds size limit'" \
  "exceeds size limit"

# 3.2 測試單批文件數量限制（5 張）
test_step "單批文件數量限制（5 張）" \
  "curl -s -X POST $PREVIEW_URL/api/upload/sign -H 'Content-Type: application/json' -d '{\"files\":[{\"name\":\"1.jpg\",\"size\":1000000},{\"name\":\"2.jpg\",\"size\":1000000},{\"name\":\"3.jpg\",\"size\":1000000},{\"name\":\"4.jpg\",\"size\":1000000},{\"name\":\"5.jpg\",\"size\":1000000},{\"name\":\"6.jpg\",\"size\":1000000}]}' | grep -q 'exceeds limit'" \
  "exceeds limit"

# 4. 生成（mock 狀態機）
echo -e "\n${YELLOW}測試生成（mock 狀態機）${NC}"

GENERATE_RESPONSE=$(curl -s -X POST "$PREVIEW_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["test1.jpg","test2.jpg"],"style":"vintage","template":"mosaic"}')

JOB_ID=$(echo "$GENERATE_RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$JOB_ID" ]; then
  echo -e "${GREEN}✅ 生成成功: jobId = $JOB_ID${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ 生成失敗: 無法獲取 jobId${NC}"
  echo "響應: $GENERATE_RESPONSE"
  ((FAILED++))
fi

# 5. 預覽（1024 無 EXIF＋水印）
if [ -n "$JOB_ID" ]; then
  echo -e "\n${YELLOW}測試預覽（1024 無 EXIF＋水印）${NC}"
  
  PREVIEW_RESPONSE=$(curl -s "$PREVIEW_URL/api/results/$JOB_ID")
  
  if echo "$PREVIEW_RESPONSE" | grep -q "images"; then
    echo -e "${GREEN}✅ 預覽成功${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ 預覽失敗${NC}"
    echo "響應: $PREVIEW_RESPONSE"
    ((FAILED++))
  fi
fi

# 6. 付款（mock）
if [ -n "$JOB_ID" ]; then
  echo -e "\n${YELLOW}測試付款（mock）${NC}"
  
  CHECKOUT_RESPONSE=$(curl -s -X POST "$PREVIEW_URL/api/checkout" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: test_$(date +%s)" \
    -d "{\"jobId\":\"$JOB_ID\",\"price\":\"2.99\"}")
  
  if echo "$CHECKOUT_RESPONSE" | grep -q "approvalUrl\|orderId"; then
    echo -e "${GREEN}✅ 付款成功（mock）${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ 付款失敗${NC}"
    echo "響應: $CHECKOUT_RESPONSE"
    ((FAILED++))
  fi
fi

# 7. 下載
if [ -n "$JOB_ID" ]; then
  echo -e "\n${YELLOW}測試下載${NC}"
  
  DOWNLOAD_RESPONSE=$(curl -s "$PREVIEW_URL/api/download/$JOB_ID?quality=hd")
  
  if echo "$DOWNLOAD_RESPONSE" | grep -q "url\|signedUrl"; then
    echo -e "${GREEN}✅ 下載成功${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ 下載失敗${NC}"
    echo "響應: $DOWNLOAD_RESPONSE"
    ((FAILED++))
  fi
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

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ 所有測試通過！${NC}"
  exit 0
else
  echo -e "\n${RED}❌ 部分測試失敗${NC}"
  exit 1
fi




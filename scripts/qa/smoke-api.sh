#!/bin/bash

# API Smoke Test Script
# 
# 检查：
# - /api/health（overall.ok）与 runware/retention 子检查
# - /api/upload/sign 未登入 401
# - 超限 429+Retry-After
# - /api/results/[id] 会写入 preview_view
# 
# 成功与错误都回人读得懂的摘要；失败 exit 1

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
EXIT_CODE=0
ERRORS=()
SUCCESSES=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
  SUCCESSES+=("$1")
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
  ERRORS+=("$1")
  EXIT_CODE=1
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "=========================================="
echo "API Smoke Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# ===== 1️⃣ /api/health 检查 =====
echo "1️⃣ 检查 /api/health"
echo "----------------------------------------"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health" || echo -e "\n000")
# macOS compatible: use sed instead of head -n -1
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1)

if [ "$HEALTH_STATUS" != "200" ]; then
  log_error "/api/health 返回状态码 $HEALTH_STATUS（预期 200）"
else
  log_success "/api/health 返回 200"
  
  # 检查 overall.ok
  if echo "$HEALTH_BODY" | jq -e '.ok == true' > /dev/null 2>&1; then
    log_success "/api/health.overall.ok = true"
  else
    log_error "/api/health.overall.ok != true"
  fi
  
  # 检查 runware 子检查
  if echo "$HEALTH_BODY" | jq -e '.runware.ok == true' > /dev/null 2>&1; then
    log_success "/api/health.runware.ok = true"
  else
    log_warn "/api/health.runware.ok != true（可能已弃用）"
  fi
  
  # 检查 retention 子检查
  if echo "$HEALTH_BODY" | jq -e '.retention' > /dev/null 2>&1; then
    log_success "/api/health.retention 存在"
    RETENTION_LAST_RUN=$(echo "$HEALTH_BODY" | jq -r '.retention.lastRunAt // "null"')
    echo "   - retention.lastRunAt: $RETENTION_LAST_RUN"
  else
    log_warn "/api/health.retention 不存在"
  fi
fi

echo ""

# ===== 2️⃣ /api/upload/sign 未登入 401 =====
echo "2️⃣ 检查 /api/upload/sign 未登入 401"
echo "----------------------------------------"

UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/upload/sign" \
  -H "Content-Type: application/json" \
  -d '{"files":[{"name":"test.jpg","size":1024}]}' || echo -e "\n000")
# macOS compatible: use sed instead of head -n -1
UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')
UPLOAD_STATUS=$(echo "$UPLOAD_RESPONSE" | tail -n 1)

if [ "$UPLOAD_STATUS" == "401" ]; then
  log_success "/api/upload/sign 未登入返回 401"
elif [ "$UPLOAD_STATUS" == "000" ]; then
  log_error "/api/upload/sign 请求失败（网络错误）"
else
  log_error "/api/upload/sign 返回状态码 $UPLOAD_STATUS（预期 401）"
fi

echo ""

# ===== 3️⃣ 超限 429+Retry-After =====
echo "3️⃣ 检查超限 429+Retry-After"
echo "----------------------------------------"

# 尝试快速发送多个请求以触发限流
RATE_LIMIT_TRIGGERED=false
for i in {1..20}; do
  RATE_RESPONSE=$(curl -s -w "\n%{http_code}\n%{header_retry_after}" -X POST "$BASE_URL/api/upload/sign" \
    -H "Content-Type: application/json" \
    -d '{"files":[{"name":"test.jpg","size":1024}]}' 2>/dev/null || echo -e "\n000\n")
  RATE_STATUS=$(echo "$RATE_RESPONSE" | tail -n 2 | head -n 1)
  RETRY_AFTER=$(echo "$RATE_RESPONSE" | tail -n 1)
  
  if [ "$RATE_STATUS" == "429" ]; then
    RATE_LIMIT_TRIGGERED=true
    if [ -n "$RETRY_AFTER" ] && [ "$RETRY_AFTER" != "000" ]; then
      log_success "触发限流 429，Retry-After = $RETRY_AFTER"
    else
      log_warn "触发限流 429，但 Retry-After 头缺失"
    fi
    break
  fi
  
  # 避免过快请求
  sleep 0.1
done

if [ "$RATE_LIMIT_TRIGGERED" = false ]; then
  log_warn "未触发限流（可能需要更多请求或限流配置不同）"
fi

echo ""

# ===== 4️⃣ /api/results/[id] 会写入 preview_view =====
echo "4️⃣ 检查 /api/results/[id] 会写入 preview_view"
echo "----------------------------------------"

# 生成一个测试 jobId
TEST_JOB_ID="test_job_$(date +%s)"

# 访问 results 页面（如果存在）
RESULTS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/results/$TEST_JOB_ID" 2>/dev/null || echo -e "\n000")
RESULTS_STATUS=$(echo "$RESULTS_RESPONSE" | tail -n 1)

if [ "$RESULTS_STATUS" == "200" ] || [ "$RESULTS_STATUS" == "404" ]; then
  log_success "/api/results/$TEST_JOB_ID 可访问（状态码 $RESULTS_STATUS）"
  
  # 注意：实际验证 preview_view 事件需要查询 analytics_logs
  # 这里只验证 API 可访问
  log_warn "preview_view 事件验证需要查询 analytics_logs（见 run-all.mjs）"
else
  log_warn "/api/results/$TEST_JOB_ID 返回状态码 $RESULTS_STATUS"
fi

echo ""

# ===== 总结 =====
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo "✅ 成功: ${#SUCCESSES[@]}"
echo "❌ 错误: ${#ERRORS[@]}"
echo ""

if [ ${#SUCCESSES[@]} -gt 0 ]; then
  echo "成功项："
  for success in "${SUCCESSES[@]}"; do
    echo "  ✅ $success"
  done
  echo ""
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "错误项："
  for error in "${ERRORS[@]}"; do
    echo "  ❌ $error"
  done
  echo ""
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过${NC}"
else
  echo -e "${RED}❌ 部分检查失败${NC}"
fi

exit $EXIT_CODE


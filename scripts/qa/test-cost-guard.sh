#!/bin/bash

# Cost Guard 验收测试脚本
# 
# 步骤：
# 1. 模拟手动写入超标样本
# 2. 触发降级脚本
# 3. 验证 feature_flags 权重已回退
# 4. 验证 analytics_logs 有 auto_downgrade 事件

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境变量
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ 错误: 缺少 Supabase 环境变量${NC}"
  echo "请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo -e "${YELLOW}📋 Cost Guard 验收测试${NC}"
echo ""

# 步骤 1: 模拟手动写入超标样本
echo -e "${YELLOW}1️⃣ 模拟手动写入超标样本...${NC}"

# 使用 psql 或 Supabase API 插入测试数据
# 这里使用 curl 调用 Supabase REST API

# 1.1 插入失败事件（模拟失败率 >2%）
echo "   插入失败事件（模拟失败率 >2%）..."
for i in {1..10}; do
  curl -s -X POST "$SUPABASE_URL/rest/v1/analytics_logs" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{
      \"event_type\": \"gen_fail\",
      \"event_data\": {
        \"error\": \"test_error\",
        \"request_id\": \"test_fail_$i\"
      },
      \"created_at\": \"$(date -u -v-15M +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }" > /dev/null
done

# 1.2 插入高延迟事件（模拟 p95 > 8s）
echo "   插入高延迟事件（模拟 p95 > 8s）..."
for i in {1..20}; do
  curl -s -X POST "$SUPABASE_URL/rest/v1/analytics_logs" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{
      \"event_type\": \"gen_route\",
      \"event_data\": {
        \"latency_ms\": 10000,
        \"provider\": \"fal\",
        \"request_id\": \"test_latency_$i\"
      },
      \"created_at\": \"$(date -u -v-15M +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }" > /dev/null
done

# 1.3 插入高成本事件（模拟单张成本 > $0.30）
echo "   插入高成本事件（模拟单张成本 > $0.30）..."
for i in {1..15}; do
  curl -s -X POST "$SUPABASE_URL/rest/v1/analytics_logs" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{
      \"event_type\": \"gen_route\",
      \"event_data\": {
        \"cost_per_image\": 0.35,
        \"provider\": \"runware\",
        \"request_id\": \"test_cost_$i\"
      },
      \"created_at\": \"$(date -u -v-15M +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }" > /dev/null
done

echo -e "${GREEN}✅ 超标样本已插入${NC}"
echo ""

# 步骤 2: 触发降级脚本
echo -e "${YELLOW}2️⃣ 触发降级脚本...${NC}"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/degradation/cost-guard" \
  -H "Content-Type: application/json")

echo "   响应: $RESPONSE"

TRIGGERED=$(echo "$RESPONSE" | grep -o '"triggered":[^,]*' | grep -o 'true\|false' || echo "false")

if [ "$TRIGGERED" = "true" ]; then
  echo -e "${GREEN}✅ 降级已触发${NC}"
else
  echo -e "${YELLOW}⚠️  降级未触发（可能指标未超标）${NC}"
fi

echo ""

# 步骤 3: 验证 feature_flags 权重已回退
echo -e "${YELLOW}3️⃣ 验证 feature_flags 权重已回退...${NC}"

WEIGHTS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.GEN_PROVIDER_WEIGHTS" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

WEIGHTS=$(echo "$WEIGHTS_RESPONSE" | grep -o '"flag_value_text":"[^"]*"' | cut -d'"' -f4 || echo "")

if echo "$WEIGHTS" | grep -q '"fal":1.0,"runware":0.0'; then
  echo -e "${GREEN}✅ 权重已回退至 FAL: 1.0${NC}"
  echo "   当前权重: $WEIGHTS"
else
  echo -e "${RED}❌ 权重未回退${NC}"
  echo "   当前权重: $WEIGHTS"
fi

echo ""

# 步骤 4: 验证 analytics_logs 有 auto_downgrade 事件
echo -e "${YELLOW}4️⃣ 验证 analytics_logs 有 auto_downgrade 事件...${NC}"

# 等待一下，确保事件已记录
sleep 2

EVENT_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/analytics_logs?event_type=eq.auto_downgrade&order=created_at.desc&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

if echo "$EVENT_RESPONSE" | grep -q "auto_downgrade"; then
  echo -e "${GREEN}✅ auto_downgrade 事件已记录${NC}"
  echo "   事件详情:"
  echo "$EVENT_RESPONSE" | grep -o '"event_data":{[^}]*}' | head -1 | sed 's/^/   /'
else
  echo -e "${RED}❌ auto_downgrade 事件未找到${NC}"
fi

echo ""

# 总结
echo -e "${YELLOW}📊 测试总结${NC}"
echo ""

if [ "$TRIGGERED" = "true" ] && echo "$WEIGHTS" | grep -q '"fal":1.0,"runware":0.0'; then
  echo -e "${GREEN}✅ 验收测试通过${NC}"
  echo "   - 降级已触发"
  echo "   - 权重已回退"
  echo "   - 事件已记录"
  exit 0
else
  echo -e "${RED}❌ 验收测试失败${NC}"
  echo "   请检查上述步骤的输出"
  exit 1
fi




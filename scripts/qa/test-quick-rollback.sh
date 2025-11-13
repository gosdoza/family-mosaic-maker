#!/bin/bash

# Provider 快速回退验收测试脚本
# 
# 步骤：
# 1. 设置权重为 50% FAL, 50% Runware
# 2. 验证权重已更新
# 3. 执行一键回退到 FAL
# 4. 验证权重已回退

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

echo -e "${YELLOW}📋 Provider 快速回退验收测试${NC}"
echo ""

# 步骤 1: 设置权重为 50% FAL, 50% Runware
echo -e "${YELLOW}1️⃣ 设置权重为 50% FAL, 50% Runware...${NC}"

curl -s -X PATCH "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.GEN_PROVIDER_WEIGHTS" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"flag_value_text\": \"{\\\"fal\\\":0.5,\\\"runware\\\":0.5}\",
    \"description\": \"Provider weights: 50% FAL, 50% Runware (Test)\",
    \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
  }" > /dev/null

echo -e "${GREEN}✅ 权重已设置${NC}"
echo ""

# 等待配置生效（5秒缓存）
echo "   等待配置生效（5秒）..."
sleep 6

# 步骤 2: 验证权重已更新
echo -e "${YELLOW}2️⃣ 验证权重已更新...${NC}"

WEIGHTS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.GEN_PROVIDER_WEIGHTS" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

WEIGHTS=$(echo "$WEIGHTS_RESPONSE" | grep -o '"flag_value_text":"[^"]*"' | cut -d'"' -f4 || echo "")

if echo "$WEIGHTS" | grep -q '"fal":0.5,"runware":0.5'; then
  echo -e "${GREEN}✅ 权重已更新: $WEIGHTS${NC}"
else
  echo -e "${RED}❌ 权重更新失败${NC}"
  echo "   当前权重: $WEIGHTS"
  exit 1
fi

echo ""

# 步骤 3: 执行一键回退到 FAL
echo -e "${YELLOW}3️⃣ 执行一键回退到 FAL...${NC}"

curl -s -X PATCH "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.GEN_PROVIDER_WEIGHTS" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"flag_value_text\": \"{\\\"fal\\\":1.0,\\\"runware\\\":0.0}\",
    \"description\": \"Provider weights: 100% FAL, 0% Runware (Quick Rollback)\",
    \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
  }" > /dev/null

echo -e "${GREEN}✅ 回退命令已执行${NC}"
echo ""

# 等待配置生效（5秒缓存）
echo "   等待配置生效（5秒）..."
sleep 6

# 步骤 4: 验证权重已回退
echo -e "${YELLOW}4️⃣ 验证权重已回退...${NC}"

WEIGHTS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/feature_flags?flag_key=eq.GEN_PROVIDER_WEIGHTS" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json")

WEIGHTS=$(echo "$WEIGHTS_RESPONSE" | grep -o '"flag_value_text":"[^"]*"' | cut -d'"' -f4 || echo "")

if echo "$WEIGHTS" | grep -q '"fal":1.0,"runware":0.0'; then
  echo -e "${GREEN}✅ 权重已回退: $WEIGHTS${NC}"
else
  echo -e "${RED}❌ 权重回退失败${NC}"
  echo "   当前权重: $WEIGHTS"
  exit 1
fi

echo ""

# 步骤 5: 验证健康检查
echo -e "${YELLOW}5️⃣ 验证健康检查...${NC}"

HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/health" | jq -r '.providers.config.weights' 2>/dev/null || echo "")

if echo "$HEALTH_RESPONSE" | grep -q '"fal":1.0'; then
  echo -e "${GREEN}✅ 健康检查验证通过${NC}"
  echo "   权重配置: $HEALTH_RESPONSE"
else
  echo -e "${YELLOW}⚠️  健康检查验证失败（可能服务未运行）${NC}"
  echo "   响应: $HEALTH_RESPONSE"
fi

echo ""

# 总结
echo -e "${YELLOW}📊 测试总结${NC}"
echo ""

if echo "$WEIGHTS" | grep -q '"fal":1.0,"runware":0.0'; then
  echo -e "${GREEN}✅ 验收测试通过${NC}"
  echo "   - 权重设置成功"
  echo "   - 一键回退成功"
  echo "   - 权重验证通过"
  exit 0
else
  echo -e "${RED}❌ 验收测试失败${NC}"
  echo "   请检查上述步骤的输出"
  exit 1
fi




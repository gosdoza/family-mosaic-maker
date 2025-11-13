#!/bin/bash

# 添加 RUNWARE_API_KEY 和 RUNWARE_ENV 环境变量并触发 Preview 重新部署
# 
# 用法:
#   ./scripts/ops/add-runware-env.sh [RUNWARE_API_KEY]
#
# 如果提供了 RUNWARE_API_KEY，将自动设置；否则会提示输入

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  添加 RUNWARE 环境变量并触发 Preview 重新部署                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Vercel 登录状态
echo -e "${YELLOW}📋 Step 1: 检查 Vercel 登录状态...${NC}"
if ! vercel whoami >/dev/null 2>&1; then
  echo -e "${RED}❌ 未登录 Vercel，请先登录${NC}"
  vercel login
else
  echo -e "${GREEN}✅ 已登录 Vercel${NC}"
  vercel whoami
fi
echo ""

# 检查项目链接
echo -e "${YELLOW}📋 Step 2: 检查项目链接...${NC}"
if [ ! -f ".vercel/project.json" ]; then
  echo -e "${YELLOW}⚠️  项目未链接，正在链接...${NC}"
  vercel link --yes || true
else
  echo -e "${GREEN}✅ 项目已链接${NC}"
fi
echo ""

# 获取 RUNWARE_API_KEY
RUNWARE_API_KEY="${1:-}"

if [ -z "$RUNWARE_API_KEY" ]; then
  echo -e "${YELLOW}📋 Step 3: 获取 RUNWARE_API_KEY...${NC}"
  read -sp "请输入 RUNWARE_API_KEY (输入将隐藏): " RUNWARE_API_KEY
  echo ""
  if [ -z "$RUNWARE_API_KEY" ]; then
    echo -e "${RED}❌ RUNWARE_API_KEY 不能为空${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}📋 Step 3: 使用提供的 RUNWARE_API_KEY...${NC}"
fi
echo ""

# 设置环境变量的函数
set_env_var() {
  local var_name=$1
  local env_type=$2
  local value=$3
  
  if [ -z "$value" ]; then
    echo -e "${YELLOW}⚠️  跳过 $var_name [$env_type] (值为空)${NC}"
    return
  fi
  
  echo "设置 $var_name [$env_type]..."
  # 删除现有变量（如果存在）
  vercel env rm "$var_name" "$env_type" -y >/dev/null 2>&1 || true
  # 添加新值
  echo "$value" | vercel env add "$var_name" "$env_type" >/dev/null 2>&1
  echo -e "${GREEN}✅ 已设置 $var_name [$env_type]${NC}"
}

# 设置 Preview 环境变量
echo -e "${YELLOW}📋 Step 4: 设置 Preview 环境变量...${NC}"
set_env_var "RUNWARE_API_KEY" "preview" "$RUNWARE_API_KEY"
set_env_var "RUNWARE_ENV" "preview" "production"
echo ""

# 设置 Production 环境变量
echo -e "${YELLOW}📋 Step 5: 设置 Production 环境变量...${NC}"
set_env_var "RUNWARE_API_KEY" "production" "$RUNWARE_API_KEY"
set_env_var "RUNWARE_ENV" "production" "production"
echo ""

# 验证环境变量
echo -e "${YELLOW}📋 Step 6: 验证环境变量...${NC}"
ENV_LIST=$(vercel env ls 2>&1)

check_var() {
  local var_name=$1
  local env_type=$2
  
  if echo "$ENV_LIST" | grep -q "$var_name.*$env_type"; then
    echo -e "${GREEN}✅ $var_name [$env_type] - 已存在${NC}"
    return 0
  else
    echo -e "${RED}❌ $var_name [$env_type] - 缺失${NC}"
    return 1
  fi
}

check_var "RUNWARE_API_KEY" "Preview" || exit 1
check_var "RUNWARE_ENV" "Preview" || exit 1
check_var "RUNWARE_API_KEY" "Production" || exit 1
check_var "RUNWARE_ENV" "Production" || exit 1
echo ""

# 触发 Preview 重新部署
echo -e "${YELLOW}📋 Step 7: 触发 Preview 重新部署...${NC}"
echo "正在部署 Preview..."
DEPLOY_OUTPUT=$(vercel --prebuilt --prod=false --yes 2>&1)
PREVIEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -n1 || echo "")

if [ -z "$PREVIEW_URL" ]; then
  PREVIEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -i 'deployment\|preview\|ready' | grep -oE 'https://[^\s]+' | head -n1 || echo "")
fi

if [ -n "$PREVIEW_URL" ]; then
  echo -e "${GREEN}✅ Preview 部署成功${NC}"
  echo -e "${BLUE}   Preview URL: $PREVIEW_URL${NC}"
else
  echo -e "${YELLOW}⚠️  无法从输出中提取 Preview URL${NC}"
  echo "部署输出:"
  echo "$DEPLOY_OUTPUT" | tail -20
fi
echo ""

# 等待部署完成
echo -e "${YELLOW}📋 Step 8: 等待部署完成...${NC}"
sleep 5
echo ""

# 验证 Preview 网站
if [ -n "$PREVIEW_URL" ]; then
  echo -e "${YELLOW}📋 Step 9: 验证 Preview 网站...${NC}"
  echo "检查 $PREVIEW_URL ..."
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PREVIEW_URL" || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✅ Preview 网站正常 (HTTP $HTTP_CODE)${NC}"
  else
    echo -e "${YELLOW}⚠️  Preview 网站响应异常 (HTTP $HTTP_CODE)${NC}"
    echo "可能需要等待更长时间，或检查部署日志"
  fi
  echo ""
fi

# 总结
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  完成总结                                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ 环境变量已添加:${NC}"
echo "   - RUNWARE_API_KEY (Preview + Production)"
echo "   - RUNWARE_ENV=production (Preview + Production)"
echo ""
if [ -n "$PREVIEW_URL" ]; then
  echo -e "${GREEN}✅ Preview 已重新部署:${NC}"
  echo "   URL: $PREVIEW_URL"
  echo ""
fi
echo -e "${YELLOW}📝 验证命令:${NC}"
echo "   vercel env ls | grep RUNWARE"
echo "   curl -s $PREVIEW_URL/api/health | jq"
echo ""




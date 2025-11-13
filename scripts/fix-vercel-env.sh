#!/bin/bash

# 校正 Vercel Preview/Production 环境变量
# 确保必需变量存在且值正确

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Vercel 环境变量校正脚本                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查必需变量
echo "📋 Step 1: 检查当前环境变量..."
echo ""

# 获取当前环境变量列表
ENV_LIST=$(vercel env ls 2>&1)

# 检查变量是否存在
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

# 设置环境变量
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
  echo "$value" | vercel env add "$var_name" "$env_type"
  echo -e "${GREEN}✅ 已设置 $var_name [$env_type]${NC}"
}

# 检查必需变量
echo "检查必需变量:"
echo ""

MISSING_VARS=0

# 检查 NEXT_PUBLIC_USE_MOCK
check_var "NEXT_PUBLIC_USE_MOCK" "Preview" || MISSING_VARS=1
check_var "NEXT_PUBLIC_USE_MOCK" "Production" || MISSING_VARS=1

# 检查 Supabase 变量
check_var "NEXT_PUBLIC_SUPABASE_URL" "Preview" || MISSING_VARS=1
check_var "NEXT_PUBLIC_SUPABASE_URL" "Production" || MISSING_VARS=1
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Preview" || MISSING_VARS=1
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Production" || MISSING_VARS=1

echo ""

# 如果缺少变量，提示用户输入
if [ $MISSING_VARS -eq 1 ]; then
  echo "📝 Step 2: 设置缺失的环境变量..."
  echo ""
  
  # 检查并设置 NEXT_PUBLIC_USE_MOCK
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_USE_MOCK.*Preview"; then
    echo "设置 NEXT_PUBLIC_USE_MOCK [Preview] = true"
    echo "true" | vercel env add "NEXT_PUBLIC_USE_MOCK" "preview"
    echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_USE_MOCK [Preview] = true${NC}"
  fi
  
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_USE_MOCK.*Production"; then
    echo "设置 NEXT_PUBLIC_USE_MOCK [Production] = false"
    echo "false" | vercel env add "NEXT_PUBLIC_USE_MOCK" "production"
    echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_USE_MOCK [Production] = false${NC}"
  fi
  
  # 检查 Supabase 变量
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_SUPABASE_URL.*Preview"; then
    read -p "请输入 NEXT_PUBLIC_SUPABASE_URL (Preview): " SUPABASE_URL
    if [ -n "$SUPABASE_URL" ]; then
      echo "$SUPABASE_URL" | vercel env add "NEXT_PUBLIC_SUPABASE_URL" "preview"
      echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_SUPABASE_URL [Preview]${NC}"
    fi
  fi
  
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_SUPABASE_URL.*Production"; then
    read -p "请输入 NEXT_PUBLIC_SUPABASE_URL (Production): " SUPABASE_URL_PROD
    if [ -n "$SUPABASE_URL_PROD" ]; then
      echo "$SUPABASE_URL_PROD" | vercel env add "NEXT_PUBLIC_SUPABASE_URL" "production"
      echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_SUPABASE_URL [Production]${NC}"
    fi
  fi
  
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY.*Preview"; then
    read -p "请输入 NEXT_PUBLIC_SUPABASE_ANON_KEY (Preview): " SUPABASE_ANON_KEY
    if [ -n "$SUPABASE_ANON_KEY" ]; then
      echo "$SUPABASE_ANON_KEY" | vercel env add "NEXT_PUBLIC_SUPABASE_ANON_KEY" "preview"
      echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_SUPABASE_ANON_KEY [Preview]${NC}"
    fi
  fi
  
  if ! echo "$ENV_LIST" | grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY.*Production"; then
    read -p "请输入 NEXT_PUBLIC_SUPABASE_ANON_KEY (Production): " SUPABASE_ANON_KEY_PROD
    if [ -n "$SUPABASE_ANON_KEY_PROD" ]; then
      echo "$SUPABASE_ANON_KEY_PROD" | vercel env add "NEXT_PUBLIC_SUPABASE_ANON_KEY" "production"
      echo -e "${GREEN}✅ 已设置 NEXT_PUBLIC_SUPABASE_ANON_KEY [Production]${NC}"
    fi
  fi
else
  echo "✅ 所有必需变量已存在"
  echo ""
  echo "📝 Step 2: 验证变量值..."
  echo ""
  
  # 验证 NEXT_PUBLIC_USE_MOCK 的值
  echo "验证 NEXT_PUBLIC_USE_MOCK 的值:"
  
  # 获取 Preview 的值（需要解密或检查）
  PREVIEW_MOCK=$(vercel env ls preview 2>&1 | grep "NEXT_PUBLIC_USE_MOCK" | awk '{print $2}' || echo "")
  if [ "$PREVIEW_MOCK" = "Encrypted" ] || [ -n "$PREVIEW_MOCK" ]; then
    echo -e "${GREEN}✅ NEXT_PUBLIC_USE_MOCK [Preview] - 已设置${NC}"
    echo "   提示: Preview 应为 true"
  else
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_USE_MOCK [Preview] - 需要验证${NC}"
  fi
  
  PROD_MOCK=$(vercel env ls production 2>&1 | grep "NEXT_PUBLIC_USE_MOCK" | awk '{print $2}' || echo "")
  if [ "$PROD_MOCK" = "Encrypted" ] || [ -n "$PROD_MOCK" ]; then
    echo -e "${GREEN}✅ NEXT_PUBLIC_USE_MOCK [Production] - 已设置${NC}"
    echo "   提示: Production 应为 false"
  else
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_USE_MOCK [Production] - 需要验证${NC}"
  fi
fi

echo ""
echo "📋 Step 3: 最终环境变量列表..."
echo ""
vercel env ls 2>&1 | grep -E "NEXT_PUBLIC_" || echo "⚠️  无法列出环境变量"

echo ""
echo "🚀 Step 4: 触发 Preview 重新部署..."
echo ""
echo "执行: vercel deploy --prebuilt --prod=false --yes"
vercel deploy --prebuilt --prod=false --yes 2>&1 | tail -20

echo ""
echo "✅ 完成！"
echo ""
echo "📋 验收命令:"
echo "  1. vercel env ls                    # 确认键值"
echo "  2. curl -i <preview>/api/health     # 验证健康检查"




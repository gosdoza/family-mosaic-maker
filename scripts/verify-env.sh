#!/bin/bash

# 環境變數驗證腳本
# Usage: ./scripts/verify-env.sh [.env.file]

set -e

ENV_FILE="${1:-.env.local}"

echo "🔍 驗證環境變數..."
echo "檢查檔案: $ENV_FILE"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 檔案不存在: $ENV_FILE"
  exit 1
fi

# 載入環境變數
set -a
source "$ENV_FILE"
set +a

# 必需變數列表
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_USE_MOCK"
)

# 可選但建議的變數
RECOMMENDED_VARS=(
  "RUNWARE_API_KEY"
  "PAYPAL_CLIENT_ID"
  "PAYPAL_CLIENT_SECRET"
  "NEXT_PUBLIC_SENTRY_DSN"
  "DOMAIN"
)

# 檢查必需變數
echo "📋 必需變數："
MISSING_REQUIRED=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ❌ $var - 缺失"
    MISSING_REQUIRED=1
  else
    # 隱藏敏感值
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"SECRET"* ]]; then
      echo "  ✅ $var - 已設定 (${!var:0:10}...)"
    else
      echo "  ✅ $var - 已設定"
    fi
  fi
done

echo ""
echo "💡 建議變數："
MISSING_RECOMMENDED=0
for var in "${RECOMMENDED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ⚠️  $var - 缺失（建議設定）"
    MISSING_RECOMMENDED=1
  else
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"SECRET"* ]]; then
      echo "  ✅ $var - 已設定 (${!var:0:10}...)"
    else
      echo "  ✅ $var - 已設定"
    fi
  fi
done

echo ""
echo "🔐 Mock 模式狀態："
if [ "$NEXT_PUBLIC_USE_MOCK" = "true" ]; then
  echo "  ⚠️  Mock 模式已啟用（開發/測試環境）"
else
  echo "  ✅ Mock 模式已關閉（生產環境）"
fi

echo ""
if [ $MISSING_REQUIRED -eq 1 ]; then
  echo "❌ 缺少必需變數，請檢查設定"
  exit 1
elif [ $MISSING_RECOMMENDED -eq 1 ]; then
  echo "⚠️  缺少建議變數，某些功能可能無法使用"
  exit 0
else
  echo "✅ 所有環境變數驗證通過"
  exit 0
fi


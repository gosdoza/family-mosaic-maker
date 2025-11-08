#!/bin/bash
# 部署前檢查腳本

set -e

echo "🧭 部署前操作清單檢查"
echo ""

# 檢查 Supabase CLI
echo "① 檢查 Supabase CLI..."
if command -v supabase &> /dev/null; then
    echo "   ✅ Supabase CLI 已安裝"
    supabase --version
else
    echo "   ❌ Supabase CLI 未安裝"
    echo "   請執行: npm install -g supabase"
    exit 1
fi

# 檢查環境變數
echo ""
echo "② 檢查環境變數..."
if [ -f .env.local ]; then
    echo "   ✅ .env.local 存在"
    
    if grep -q "USE_MOCK=false" .env.local; then
        echo "   ✅ USE_MOCK=false (生產模式)"
    else
        echo "   ⚠️  USE_MOCK 未設置為 false"
    fi
    
    if grep -q "PAYPAL_CLIENT_ID" .env.local; then
        echo "   ✅ PAYPAL_CLIENT_ID 已設置"
    else
        echo "   ⚠️  PAYPAL_CLIENT_ID 未設置"
    fi
    
    if grep -q "PAYPAL_WEBHOOK_ID" .env.local; then
        echo "   ✅ PAYPAL_WEBHOOK_ID 已設置"
    else
        echo "   ⚠️  PAYPAL_WEBHOOK_ID 未設置"
    fi
else
    echo "   ❌ .env.local 不存在"
    exit 1
fi

# 檢查遷移文件
echo ""
echo "③ 檢查遷移文件..."
if [ -f "supabase/migrations/20250115000000_add_orders.sql" ]; then
    echo "   ✅ 遷移文件存在"
else
    echo "   ❌ 遷移文件不存在"
    exit 1
fi

# 檢查測試文件
echo ""
echo "④ 檢查測試文件..."
if [ -f "tests/paypal-checkout-flow.spec.ts" ]; then
    echo "   ✅ paypal-checkout-flow.spec.ts 存在"
else
    echo "   ⚠️  paypal-checkout-flow.spec.ts 不存在"
fi

if [ -f "tests/paypal-orders-status.spec.ts" ]; then
    echo "   ✅ paypal-orders-status.spec.ts 存在"
else
    echo "   ⚠️  paypal-orders-status.spec.ts 不存在"
fi

if [ -f "tests/webhook-idempotency.spec.ts" ]; then
    echo "   ✅ webhook-idempotency.spec.ts 存在"
else
    echo "   ⚠️  webhook-idempotency.spec.ts 不存在"
fi

echo ""
echo "✅ 檢查完成！"
echo ""
echo "下一步："
echo "1. 執行: supabase db push"
echo "2. 在 Supabase Dashboard 驗證資料表"
echo "3. 配置 PayPal Sandbox"
echo "4. 運行測試: pnpm test:e2e"

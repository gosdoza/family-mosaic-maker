#!/bin/bash

# === Super Prompt: Clean → Boot → Health → E2E (Runware/PayPal) → QA All ===

# 路径请按需调整
PROJ_DIR="/Users/tangtony/Family Mosaic Maker"
BASE_URL="http://localhost:3000"
USE_MOCK="false"   # Production 模拟：直连 Runware
HEAD_SECONDS=10    # 启动等待秒数

echo "⏱️  开始一键重开与验收流程..."

cd "$PROJ_DIR" || { echo "❌ 项目路径不存在：$PROJ_DIR"; exit 1; }

echo ""
echo "A) 干净重置：杀进程＋清暂存"
echo "===================="

pkill -f "next|node .*server|playwright" 2>/dev/null || true

( lsof -i :3000 1>/dev/null 2>&1 && kill -9 $(lsof -ti :3000) ) || true

rm -rf /tmp/dev.out /tmp/qa-run-all-output.txt test-results playwright-report 2>/dev/null || true

echo "✅ A 完成"

echo ""
echo "B) 启动 Dev Server 并健康检查"
echo "===================="

export NEXT_PUBLIC_USE_MOCK="$USE_MOCK"

pnpm dev > /tmp/dev.out 2>&1 & disown

sleep "$HEAD_SECONDS"

# 等待 /api/health 准备就绪（最多 30s）
ATTEMPTS=0
OK="false"

while [ $ATTEMPTS -lt 15 ]; do
  OK=$(curl -s "$BASE_URL/api/health" 2>/dev/null | jq -r '.ok' 2>/dev/null || echo "false")
  [ "$OK" = "true" ] && break
  sleep 2
  ATTEMPTS=$((ATTEMPTS+1))
done

echo "— /api/health.ok: $OK"
curl -s "$BASE_URL/api/health" | tee /tmp/health.json >/dev/null
echo "— Providers 权重：" && (jq -r '.providers.config.weights' /tmp/health.json 2>/dev/null || echo "(无)")
echo "— use_mock：" && (jq -r '.settings.use_mock' /tmp/health.json 2>/dev/null || echo "(未知)")

[ "$OK" != "true" ] && { echo "❌ 健康检查未通过，请先修复 /api/health"; exit 1; }

echo "✅ B 完成"

echo ""
echo "C) 验证测试登录端点（仅非 production + ALLOW_TEST_LOGIN=true 可用）"
echo "===================="

if grep -q "^ALLOW_TEST_LOGIN=" .env.local 2>/dev/null; then
  echo "— .env.local 已含 ALLOW_TEST_LOGIN"
else
  echo "⚠️ .env.local 缺少 ALLOW_TEST_LOGIN=true（E2E 将改走 UI 流或可能失败）"
fi

LOGIN_JSON=$(curl -s -X POST "$BASE_URL/api/test/login" -H "Content-Type: application/json" \
  -d '{"email":"qa1@example.com","password":"QA_test_123!"}')

LOGIN_OK=$(echo "$LOGIN_JSON" | jq -r '.ok' 2>/dev/null || echo "false")
echo "— /api/test/login: ok=$LOGIN_OK"

[ "$LOGIN_OK" != "true" ] && echo "ℹ️ 测试登录端点不可用（可忽略，E2E 将直接走 UI 登录流程）"

echo "✅ C 完成"

echo ""
echo "D) 关键 E2E（Runware 直连 & PayPal 沙盒）— 开 headed + trace 便于除错"
echo "===================="

export BASE_URL="$BASE_URL"
export NEXT_PUBLIC_USE_MOCK="$USE_MOCK"

# 1) 生成流程（Runware）
echo "▶︎ Playwright：generate-runware.spec.ts"
npx playwright test tests/e2e/generate-runware.spec.ts --project=chromium --headed --trace=on 2>&1 | tee /tmp/e2e-generate-output.txt || true

# 2) PayPal 沙盒流程
echo ""
echo "▶︎ Playwright：paypal-sandbox.spec.ts"
npx playwright test tests/e2e/paypal-sandbox.spec.ts --project=chromium --headed --trace=on 2>&1 | tee /tmp/e2e-paypal-output.txt || true

echo ""
echo "📁 若失败，可查看报告："
echo "   - npx playwright show-report"
echo "   - npx playwright show-trace test-results/**/trace.zip"

echo "✅ D 完成（若有失败，仍继续进入总扫，结果会在摘要显示）"

echo ""
echo "E) 一键总扫（System+API+E2E 全部）"
echo "===================="

export BASE_URL="$BASE_URL"
export NEXT_PUBLIC_USE_MOCK="$USE_MOCK"

pnpm qa:run-all 2>&1 | tee /tmp/qa-run-all-output.txt || true

# 总结提取
TOTAL=$(grep -E "总测试数|Running [0-9]+ tests" /tmp/qa-run-all-output.txt | tail -1 | grep -oE "[0-9]+" | head -1 || echo "0")
PASS=$(grep -E "[0-9]+ passed|通过: [0-9]+" /tmp/qa-run-all-output.txt | tail -1 | grep -oE "[0-9]+" | head -1 || echo "0")
FAIL=$(grep -E "[0-9]+ failed|失败: [0-9]+" /tmp/qa-run-all-output.txt | tail -1 | grep -oE "[0-9]+" | head -1 || echo "0")

echo ""
echo "========================================"
echo "📊 最终摘要"
echo "========================================"
echo "— 环境：USE_MOCK=$USE_MOCK, BASE_URL=$BASE_URL"
echo "— /api/health.ok: $OK"
echo "— 测试总数: $TOTAL"
echo "— 通过: $PASS"
echo "— 失败: $FAIL"
echo "— 报告：docs/qa/qa_summary.md、docs/qa/final_report.md"
echo "— Playwright 报告：npx playwright show-report"
echo "— 追踪档：test-results/**/trace.zip → npx playwright show-trace <档案>"
echo ""
echo "✅ 完成"




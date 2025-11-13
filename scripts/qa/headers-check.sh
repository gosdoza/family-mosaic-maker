#!/bin/bash

# Headers Check Script
# 
# curl -I 根路径，验 X-Content-Type-Options, Referrer-Policy, CSP/frame-ancestors（含 PayPal 白名单）

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
echo "Headers Check"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# ===== 获取响应头 =====
HEADERS=$(curl -s -I "$BASE_URL" || echo "")

if [ -z "$HEADERS" ]; then
  log_error "无法获取响应头（网络错误）"
  exit 1
fi

echo "响应头："
echo "$HEADERS"
echo ""

# ===== 1️⃣ X-Content-Type-Options =====
echo "1️⃣ 检查 X-Content-Type-Options"
echo "----------------------------------------"

X_CONTENT_TYPE_OPTIONS=$(echo "$HEADERS" | grep -i "X-Content-Type-Options" || echo "")

if [ -n "$X_CONTENT_TYPE_OPTIONS" ]; then
  if echo "$X_CONTENT_TYPE_OPTIONS" | grep -qi "nosniff"; then
    log_success "X-Content-Type-Options: nosniff"
  else
    log_error "X-Content-Type-Options 值不正确: $X_CONTENT_TYPE_OPTIONS"
  fi
else
  log_error "X-Content-Type-Options 头缺失"
fi

echo ""

# ===== 2️⃣ Referrer-Policy =====
echo "2️⃣ 检查 Referrer-Policy"
echo "----------------------------------------"

REFERRER_POLICY=$(echo "$HEADERS" | grep -i "Referrer-Policy" || echo "")

if [ -n "$REFERRER_POLICY" ]; then
  log_success "Referrer-Policy 存在: $REFERRER_POLICY"
else
  log_error "Referrer-Policy 头缺失"
fi

echo ""

# ===== 3️⃣ Content-Security-Policy (CSP) =====
echo "3️⃣ 检查 Content-Security-Policy (CSP)"
echo "----------------------------------------"

CSP=$(echo "$HEADERS" | grep -i "Content-Security-Policy" || echo "")

if [ -n "$CSP" ]; then
  log_success "Content-Security-Policy 存在"
  
  # 检查是否包含 PayPal 白名单
  if echo "$CSP" | grep -qi "paypal"; then
    log_success "CSP 包含 PayPal 白名单"
    echo "   - PayPal 域名已包含在 CSP 中"
  else
    log_warn "CSP 可能未包含 PayPal 白名单"
  fi
  
  # 检查 frame-ancestors
  if echo "$CSP" | grep -qi "frame-ancestors"; then
    log_success "CSP 包含 frame-ancestors"
    
    # 检查 frame-ancestors 是否包含 PayPal
    if echo "$CSP" | grep -qi "frame-ancestors.*paypal"; then
      log_success "frame-ancestors 包含 PayPal"
    else
      log_warn "frame-ancestors 可能未包含 PayPal"
    fi
  else
    log_warn "CSP 未包含 frame-ancestors"
  fi
else
  log_error "Content-Security-Policy 头缺失"
fi

echo ""

# ===== 4️⃣ X-Frame-Options =====
echo "4️⃣ 检查 X-Frame-Options"
echo "----------------------------------------"

X_FRAME_OPTIONS=$(echo "$HEADERS" | grep -i "X-Frame-Options" || echo "")

if [ -n "$X_FRAME_OPTIONS" ]; then
  log_success "X-Frame-Options 存在: $X_FRAME_OPTIONS"
  
  # 检查值（应该是 SAMEORIGIN 或允许 PayPal）
  if echo "$X_FRAME_OPTIONS" | grep -qi "SAMEORIGIN"; then
    log_success "X-Frame-Options: SAMEORIGIN"
  else
    log_warn "X-Frame-Options 值可能不正确: $X_FRAME_OPTIONS"
  fi
else
  log_warn "X-Frame-Options 头缺失（可能由 CSP frame-ancestors 替代）"
fi

echo ""

# ===== 5️⃣ 其他安全头 =====
echo "5️⃣ 检查其他安全头"
echo "----------------------------------------"

# Permissions-Policy
PERMISSIONS_POLICY=$(echo "$HEADERS" | grep -i "Permissions-Policy" || echo "")
if [ -n "$PERMISSIONS_POLICY" ]; then
  log_success "Permissions-Policy 存在"
else
  log_warn "Permissions-Policy 头缺失"
fi

# Strict-Transport-Security (HSTS) - 仅在 HTTPS 时存在
STRICT_TRANSPORT=$(echo "$HEADERS" | grep -i "Strict-Transport-Security" || echo "")
if [ -n "$STRICT_TRANSPORT" ]; then
  log_success "Strict-Transport-Security 存在"
else
  log_warn "Strict-Transport-Security 头缺失（仅在 HTTPS 时存在）"
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




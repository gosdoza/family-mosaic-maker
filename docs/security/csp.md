# A2 - CSP / Frame Policy 配置文檔

**版本**: v1.0.0  
**配置日期**: 2025-01-16  
**環境**: Production  
**配置人員**: Security Team

## 📋 配置概述

### 配置目的

設置 Content Security Policy (CSP) 和 Frame Policy：
- CSP 白名單（包含 PayPal）
- X-Frame-Options / frame-ancestors
- 其他安全頭部

### 配置環境

- **環境**: Production
- **實現位置**: `middleware.ts`
- **適用範圍**: 所有路由

## 🔒 CSP 配置

### CSP 指令

**default-src**: `'self'`
- 默認只允許同源資源

**script-src**: `'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com`
- 允許同源腳本
- 允許內聯腳本（用於 GA4 初始化）
- 允許 eval（用於某些第三方庫）
- 允許 Google Tag Manager
- 允許 Google Analytics
- 允許 Facebook Pixel
- 允許 Google reCAPTCHA

**style-src**: `'self' 'unsafe-inline' https://fonts.googleapis.com`
- 允許同源樣式
- 允許內聯樣式
- 允許 Google Fonts

**font-src**: `'self' https://fonts.gstatic.com data:`
- 允許同源字體
- 允許 Google Fonts
- 允許 data URI

**img-src**: `'self' data: https: blob:`
- 允許同源圖片
- 允許 data URI
- 允許 HTTPS 圖片
- 允許 blob URI（用於預覽）

**connect-src**: `'self' https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net`
- 允許同源連接
- 允許 Google Analytics
- 允許 Supabase API
- 允許 Facebook Pixel

**frame-src**: `'self' https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com`
- 允許同源 iframe
- 允許 PayPal（生產環境）
- 允許 PayPal Sandbox（測試環境）
- 允許 Google reCAPTCHA

**frame-ancestors**: `'self' https://www.paypal.com https://www.sandbox.paypal.com`
- 允許同源嵌入
- 允許 PayPal 嵌入（用於支付流程）

**object-src**: `'none'`
- 禁止所有 object 元素

**base-uri**: `'self'`
- 只允許同源 base URI

**form-action**: `'self'`
- 只允許同源表單提交

**upgrade-insecure-requests**: 啟用
- 自動升級 HTTP 請求到 HTTPS

### 開發環境調整

在開發環境中，額外允許：
- `connect-src 'self' http://localhost:* https://*.supabase.co`

## 🖼️ Frame Policy 配置

### X-Frame-Options

**值**: `SAMEORIGIN`

**說明**:
- 允許同源頁面嵌入
- 允許 PayPal 通過 `frame-ancestors` 指令嵌入

### frame-ancestors

**值**: `'self' https://www.paypal.com https://www.sandbox.paypal.com`

**說明**:
- 允許同源嵌入
- 允許 PayPal 嵌入（用於支付流程）
- 允許 PayPal Sandbox 嵌入（用於測試）

## 🔐 其他安全頭部

### X-Content-Type-Options

**值**: `nosniff`

**說明**:
- 防止 MIME 類型嗅探

### Referrer-Policy

**值**: `strict-origin-when-cross-origin`

**說明**:
- 跨域時只發送源信息
- 同源時發送完整路徑

### Permissions-Policy

**值**: `camera=(), microphone=(), geolocation=(), interest-cohort=()`

**說明**:
- 禁用攝像頭
- 禁用麥克風
- 禁用地理位置
- 禁用 FLoC（Federated Learning of Cohorts）

## 📊 配置驗證

### 驗證命令

```bash
# 檢查 CSP 頭部
curl -I https://<production-url>/ | grep -i "content-security-policy"

# 檢查 X-Frame-Options
curl -I https://<production-url>/ | grep -i "x-frame-options"

# 檢查所有安全頭部
curl -I https://<production-url>/ | grep -iE "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy"
```

### 預期輸出

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net; frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com; frame-ancestors 'self' https://www.paypal.com https://www.sandbox.paypal.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **CSP 頭部存在** | 有 `Content-Security-Policy` 頭部 | ✅ 有頭部 | ✅ 通過 |
| **X-Frame-Options 存在** | 有 `X-Frame-Options: SAMEORIGIN` | ✅ 有頭部 | ✅ 通過 |
| **PayPal 在白名單中** | `frame-src` 包含 `paypal.com` | ✅ 包含 | ✅ 通過 |
| **PayPal 可嵌入** | `frame-ancestors` 包含 `paypal.com` | ✅ 包含 | ✅ 通過 |
| **其他安全頭部存在** | 有 `X-Content-Type-Options` 等 | ✅ 有頭部 | ✅ 通過 |

## 📝 配置實現

### 實現位置

**文件**: `middleware.ts`

**函數**: `addSecurityHeaders()`

**調用位置**: `middleware()` 函數中

### 配置代碼

```typescript
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.nextUrl.origin
  const isProduction = process.env.NODE_ENV === "production"

  // Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net",
    "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com",
    "frame-ancestors 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ]

  // 在开发环境中允许更多来源
  if (!isProduction) {
    cspDirectives.push("connect-src 'self' http://localhost:* https://*.supabase.co")
  }

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "))
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  )

  return response
}
```

## 📚 相關文檔

- [Middleware 實現](../../middleware.ts)
- [PayPal 集成文檔](../paypal/integration.md)
- [安全策略文檔](../security/policies.md)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A2 CSP / Frame Policy 配置




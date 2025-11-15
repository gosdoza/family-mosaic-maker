# /auth/callback 本機 vs Production 行為比對（暫存報告）

## 1. 本機行為（http://localhost:3000）

- 測試 URL: `http://localhost:3000/auth/callback?code=fake-local-code`

- 原始 HTTP 回應（前 20 行）：

```
HTTP/1.1 302 Found
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net; frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com; frame-ancestors 'self' https://www.paypal.com https://www.sandbox.paypal.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; connect-src 'self' http://localhost:* https://*.supabase.co
permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
location: http://localhost:3000/auth/error?reason=missing_pkce_cookie
Date: Thu, 13 Nov 2025 10:27:19 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

```

## 2. Production 行為（https://family-mosaic-maker.vercel.app）

- 測試 URL: `https://family-mosaic-maker.vercel.app/auth/callback?code=fake-prod-code`

- 原始 HTTP 回應（前 20 行）：

```
HTTP/2 422 
age: 0
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Thu, 13 Nov 2025 10:27:22 GMT
permissions-policy: camera=(), geolocation=(), microphone=()
referrer-policy: strict-origin-when-cross-origin
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
x-matched-path: /auth/callback
x-vercel-cache: MISS
x-vercel-id: hkg1::iad1::vbq8v-1763029642177-f50d67f19682

{"error":"invalid request: both auth code and code verifier should be non-empty"}```

- Body 前 20 行（截斷版）：

```
```

## 3. 初步觀察

> ✅ 本機：預期應為 302 redirect 到 /auth/error 或 /auth/login，幾乎不應有 JSON body。

> ❌ Production：實際看到純 JSON，表示線上的 /auth/callback 並非使用本機相同 handler，

> 可能是：

> - Vercel 連到錯誤的 project / build output

> - 還有另一個舊的 /auth/callback handler（例如 pages/api 或其他上游）

> - 或 Supabase 直接回傳的 JSON 被當成最終回應顯示

請接下來將這個檔案內容貼給 ChatGPT，讓它幫你進一步分析差異與下一步修正策略。


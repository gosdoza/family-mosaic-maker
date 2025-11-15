# Auth Flow 邊界情境規格說明

**版本**: v1.0.0  
**建立日期**: 2025-11-13  
**目標**: 定義 Auth Flow 的 6 個邊界情境預期行為，確保 MVP 驗收標準明確

---

## 設計原則

1. **友善錯誤處理**：所有錯誤情況都應該 redirect 到 `/auth/error` 並顯示清楚的中文錯誤訊息，絕對不應該出現 JSON error。
2. **已登入狀態處理**：已登入的使用者訪問 `/auth/login` 或 `/auth/callback` 時，應該自動 redirect 到 `/dashboard`，避免重複登入流程。
3. **PKCE 安全機制**：Magic link 必須在同一瀏覽器中點擊，跨裝置/跨瀏覽器會觸發 PKCE cookie 缺失錯誤。
4. **最小可行登出**：提供基本的登出功能，清除 session 並 redirect 到首頁或登入頁。

---

## S1. Magic link 重複點擊（同一瀏覽器）

### Scenario 名稱
**S1. Magic link 重複點擊（同一瀏覽器）**

### Trigger
- 使用者在同一瀏覽器中點擊同一封 Magic link 郵件兩次
- 第一次點擊已成功登入並導向 `/dashboard`
- 第二次點擊同一連結

### Expected Behavior

**第一次點擊**：
- 正常登入流程
- Redirect 到 `/dashboard`
- Session 建立成功

**第二次點擊**：
- 如果 Supabase 認為 code 仍然有效（例如 session 已存在），則：
  - 更新 session（如果需要的話）
  - Redirect 到 `/dashboard`
  - 不顯示錯誤訊息
- 如果 Supabase 回傳 `invalid/used code` 錯誤，則：
  - **必須** redirect 到 `/auth/error?error=invalid_link`
  - **絕對不能**返回 JSON error
  - 錯誤頁面顯示「連結已失效或已使用」訊息
  - 提供「回登入頁重新寄信」按鈕

### Tech Note
- 實作層級：`/auth/callback/route.ts`
- Supabase `exchangeCodeForSession()` 會處理 code 的有效性
- 如果 code 已被使用，Supabase 會回傳錯誤，我們需要 catch 並 redirect 到 `/auth/error`
- 不需要特別檢查「是否已登入」，因為 Supabase 會處理 code 的有效性

### Test Type
**mixed**
- 自動：可以測試 `/auth/callback?code=used-code` 的 redirect 行為
- 人工：需要實際發送 Magic link 並點擊兩次來驗證完整流程

---

## S2. Magic link 過期

### Scenario 名稱
**S2. Magic link 過期**

### Trigger
- 使用者點擊已過期的 Magic link（超過 Supabase 預設的有效時間，通常為 1 小時）
- 或點擊無效的 code

### Expected Behavior
- `/auth/callback` 收到過期/無效的 code
- Supabase `exchangeCodeForSession()` 回傳錯誤（例如 `invalid_grant` 或 `expired_token`）
- **必須** redirect 到 `/auth/error?error=invalid_link`
- **絕對不能**返回 JSON error
- `/auth/error` 頁面顯示：
  - 標題：「Oops, 验证失败」
  - 錯誤訊息：「验证链接已失效或已过期。请重新发送验证邮件。」
  - 按鈕：「回登入页重新寄信」（連結到 `/auth/login`）

### Tech Note
- 實作層級：`/auth/callback/route.ts`
- 在 `exchangeCodeForSession()` 的 error handler 中，所有非 PKCE 相關的錯誤都統一 redirect 到 `/auth/error?error=invalid_link`
- `/auth/error` 頁面根據 `error=invalid_link` 顯示對應文案

### Test Type
**auto**
- 可以使用 fake/expired code 測試：`/auth/callback?code=expired-fake-code`
- 驗證 redirect 到 `/auth/error?error=invalid_link`
- 驗證錯誤頁面 HTML 包含「連結已失效」等關鍵字

---

## S3. 已登入的使用者再訪 /auth/login

### Scenario 名稱
**S3. 已登入的使用者再訪 /auth/login**

### Trigger
- 使用者已經登入（有有效的 Supabase session）
- 使用者手動輸入 URL `/auth/login` 或點擊導航中的登入連結

### Expected Behavior
- Server-side 檢查 session（使用 `getCurrentUser()`）
- 如果已登入（`user` 存在）：
  - **立即** redirect 到 `/dashboard`
  - 不顯示登入表單
  - 避免使用者看到「已登入但還顯示登入頁」的混淆情況
- 如果未登入（`user` 為 null）：
  - 正常顯示登入表單
  - 允許使用者輸入 email 並發送 Magic link

### Tech Note
- 實作層級：`app/auth/login/page.tsx`（改為 server component wrapper）
- 使用 `getCurrentUser()` 在 server-side 檢查 session
- 如果已登入，使用 `redirect("/dashboard")` 在 render 前就 redirect
- 如果未登入，render client component `<LoginClient />` 顯示登入表單

### Test Type
**mixed**
- 自動：可以測試未登入狀態下 `/auth/login` 返回 200 且包含登入表單 HTML
- 人工：需要實際登入後訪問 `/auth/login` 驗證 redirect 行為

---

## S4. 已登入訪 /auth/callback

### Scenario 名稱
**S4. 已登入訪 /auth/callback**

### Trigger
- 使用者已經登入（有有效的 Supabase session）
- 使用者點擊另一封 Magic link 郵件（或同一封信）
- 或手動輸入 `/auth/callback?code=xxx`

### Expected Behavior
- `/auth/callback` 收到 code
- 如果 Supabase 認為 code 有效：
  - 呼叫 `exchangeCodeForSession(code)` 更新 session
  - Redirect 到 `/dashboard`
  - 不顯示錯誤（因為這是合法的「重新登入」行為）
- 如果 Supabase 認為 code 無效/過期：
  - Redirect 到 `/auth/error?error=invalid_link`
  - 顯示「連結已失效」訊息

### Tech Note
- 實作層級：`/auth/callback/route.ts`
- 不需要特別檢查「是否已登入」，因為 Supabase 的 `exchangeCodeForSession()` 會處理所有情況
- 如果 code 有效，Supabase 會更新 session（即使已存在）
- 如果 code 無效，Supabase 會回傳錯誤，我們 catch 並 redirect 到 `/auth/error`

### Test Type
**mixed**
- 自動：可以測試 `/auth/callback?code=fake-code` 的 redirect 行為
- 人工：需要實際登入後點擊另一封 Magic link 驗證完整流程

---

## S5. 遠端裝置點同一封 Magic link（PKCE cookie 不在同一瀏覽器）

### Scenario 名稱
**S5. 遠端裝置點同一封 Magic link（PKCE cookie 不在同一瀏覽器）**

### Trigger
- 使用者在 Safari（桌面）請求 Magic link
- 使用者在手機 Chrome 瀏覽器中點擊同一封郵件
- 因為 PKCE `code_verifier` 只存在於原始瀏覽器（Safari）的 cookies 中
- 新瀏覽器（Chrome）沒有 `code_verifier` cookie

### Expected Behavior
- `/auth/callback` 收到 code，但 cookies 中沒有對應的 `code_verifier`
- Supabase `exchangeCodeForSession()` 回傳錯誤：
  - 錯誤訊息包含 `"both auth code and code verifier should be non-empty"`
- **必須** redirect 到 `/auth/error?reason=missing_pkce_cookie`
- **絕對不能**返回 JSON error
- `/auth/error` 頁面顯示：
  - 標題：「Oops, 验证失败」
  - 錯誤訊息：「驗證連結無法使用，請確認：寄信與點信使用同一個瀏覽器／同一個裝置，且不是用 Mail App 或 Outlook App 開啟。建議改用 Web 版信箱（例如 Gmail / Outlook Web）重新點擊連結。」
  - 按鈕：「回登入页重新寄信」（連結到 `/auth/login`）

### Tech Note
- 實作層級：`/auth/callback/route.ts`
- 在 error handler 中檢查 `error.message?.includes("both auth code and code verifier should be non-empty")`
- 如果符合，redirect 到 `/auth/error?reason=missing_pkce_cookie`
- `/auth/error` 頁面根據 `reason=missing_pkce_cookie` 顯示對應文案
- 這個錯誤已經在現有程式碼中實作，只需要確認文案清楚即可

### Test Type
**auto**
- 可以使用 fake code 測試：`/auth/callback?code=fake-code`（沒有 PKCE cookie）
- 驗證 redirect 到 `/auth/error?reason=missing_pkce_cookie`
- 驗證錯誤頁面 HTML 包含「同一個瀏覽器」等關鍵字

---

## S6. 登出（Logout）

### Scenario 名稱
**S6. 登出（Logout）**

### Trigger
- 已登入的使用者點擊「Sign out」按鈕
- 或訪問 `/auth/logout` URL

### Expected Behavior
- 建立 `/auth/logout` route（GET）
- Server-side 執行：
  1. 取得 Supabase server client
  2. 呼叫 `supabase.auth.signOut()`
  3. 確保 cookies 被正確清除（Supabase SSR 會自動處理）
  4. Redirect 到 `/`（首頁）
- UI 方面：
  - 在 Navigation 或 `/dashboard` 頁面新增「Sign out」按鈕
  - 按鈕連結到 `/auth/logout`
  - 點擊後 session 被清除，使用者被導向首頁
  - 之後訪問 `/dashboard` 會被 redirect 到 `/auth/login`

### Tech Note
- 實作層級：
  - `app/auth/logout/route.ts`：新增 server route handler
  - `components/navigation.tsx` 或 `components/dashboard/dashboard-client.tsx`：新增 Sign out 按鈕
- 使用 `lib/supabase/server.ts` 的 `createClient()` 取得 server client
- 呼叫 `supabase.auth.signOut()` 會清除所有相關 cookies
- Redirect 目標選擇 `/`（首頁），因為這是友善的預設行為

### Test Type
**mixed**
- 自動：可以測試 `/auth/logout` 的 redirect 行為（但無法驗證 session 是否真的被清除）
- 人工：需要實際登入後點擊 Sign out，然後訪問 `/dashboard` 驗證被 redirect 到 `/auth/login`

---

## 驗收完成標準

當以下所有情境都符合預期行為時，可以宣告「Auth Flow 邊界情境驗收通過」：

- ✅ **S1. Magic link 重複點擊**：第二次點擊不會出現 JSON error，會 redirect 到 `/auth/error` 或 `/dashboard`
- ✅ **S2. Magic link 過期**：過期連結會 redirect 到 `/auth/error?error=invalid_link`，顯示清楚錯誤訊息
- ✅ **S3. 已登入訪 /auth/login**：已登入使用者會被自動 redirect 到 `/dashboard`
- ✅ **S4. 已登入訪 /auth/callback**：已登入使用者點擊 Magic link 會更新 session 並 redirect 到 `/dashboard`
- ✅ **S5. 遠端裝置點連結**：跨瀏覽器/跨裝置會 redirect 到 `/auth/error?reason=missing_pkce_cookie`，顯示清楚錯誤訊息
- ✅ **S6. 登出**：Sign out 按鈕可用，點擊後 session 被清除，訪問 `/dashboard` 會被 redirect 到 `/auth/login`

---

## 備註

- 所有錯誤情況都應該 redirect，**絕對不能**返回 JSON error
- 錯誤訊息應該使用中文，清楚說明問題與解決方法
- 已登入狀態的處理應該在 server-side 完成，避免閃爍或混淆
- PKCE 安全機制是 Supabase 的標準實作，我們只需要正確處理錯誤情況


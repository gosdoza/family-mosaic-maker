# Supabase PKCE Email Login 開發備忘錄

## ⚠️ 重要注意事項

### 1. 必須「同一個瀏覽器、同一個 domain」觸發 + 點信

**PKCE (Proof Key for Code Exchange) 流程要求**:
- ✅ 用戶在 **同一個瀏覽器** 中發送 Magic Link
- ✅ 用戶在 **同一個瀏覽器** 中點擊郵件中的連結
- ✅ 必須在 **同一個 domain** 中完成整個流程

**為什麼？**
- Supabase SDK 會在發送 Magic Link 時，在瀏覽器的 cookies 中儲存 `code_verifier`
- 當用戶點擊郵件中的連結時，`/auth/callback` route 需要從 cookies 讀取 `code_verifier`
- 如果用戶在不同的瀏覽器或不同的 domain 中打開連結，cookies 會丟失，導致驗證失敗

**錯誤訊息**:
```
"both auth code and code verifier should be non-empty"
```

這個錯誤表示 `code_verifier` 無法從 cookies 中讀取，通常發生在：
- 用戶在不同的瀏覽器中打開連結
- 用戶在不同的 domain 中打開連結（例如從 Preview 發送，在 Production 打開）
- 用戶清除了瀏覽器的 cookies

---

### 2. 不要用 Supabase Dashboard 裡的「Send magic link」來測 PKCE

**原因**:
- Supabase Dashboard 的「Send magic link」功能不會在瀏覽器中設置 `code_verifier` cookie
- 這會導致 `exchangeCodeForSession` 失敗，出現 "both auth code and code verifier should be non-empty" 錯誤

**正確的測試方式**:
1. 在應用程式的登入頁面 (`/auth/login`) 輸入郵箱
2. 點擊「Send Magic Link」按鈕
3. 檢查郵箱，點擊郵件中的連結
4. 驗證是否成功重定向到 `/dashboard`

---

### 3. 如果使用者點到舊信、不同瀏覽器或不同 domain，會被導到 /auth/error

**錯誤處理流程**:
1. 如果 `code_verifier` 無法從 cookies 讀取，`exchangeCodeForSession` 會失敗
2. Callback route 會檢測到 "both auth code and code verifier should be non-empty" 錯誤
3. 重定向到 `/auth/error?reason=missing_pkce_cookie`
4. 錯誤頁面會顯示友好的錯誤訊息，並提供「回登入頁重新寄信」按鈕

**常見場景**:
- ❌ 用戶在 Chrome 發送 Magic Link，但在 Safari 中打開連結
- ❌ 用戶在 Preview 環境發送 Magic Link，但在 Production 環境打開連結
- ❌ 用戶點擊了過期的 Magic Link（cookies 已清除）
- ❌ 用戶在無痕模式中打開連結（cookies 無法持久化）

---

## 🔧 技術實作細節

### Login 頁面 (`app/auth/login/page.tsx`)

**關鍵點**:
- 使用 `createBrowserClient` 從 `@supabase/ssr`（通過 `lib/supabase/client.ts`）
- 使用 `window.location.origin` 作為 `emailRedirectTo`（不要使用 `.env` 中的 `DOMAIN`）
- 設置 `shouldCreateUser: true` 允許自動創建新用戶

```typescript
const emailRedirectTo = `${window.location.origin}/auth/callback`

await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo,
    shouldCreateUser: true,
  },
})
```

### Callback Route (`app/auth/callback/route.ts`)

**關鍵點**:
- 使用 `createServerClient` 從 `@supabase/ssr`（不是 `createClient` 從 `@supabase/supabase-js`）
- 正確配置 cookie adapter，從 `cookies()` 讀取 cookies
- 調用 `exchangeCodeForSession(code)`，Supabase SSR 會自動從 cookies 讀取 `code_verifier`
- 特殊處理 "both auth code and code verifier should be non-empty" 錯誤

```typescript
const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // ...
      },
    },
  }
)

const { data, error } = await supabase.auth.exchangeCodeForSession(code)
```

### Error 頁面 (`app/auth/error/page.tsx`)

**關鍵點**:
- 處理 `reason=missing_pkce_cookie` 參數，顯示特定的錯誤訊息
- 提供「回登入頁重新寄信」按鈕
- 顯示友好的錯誤訊息，而不是技術性的錯誤代碼

---

## 📋 測試檢查清單

### 本地測試
- [ ] 在 `http://localhost:3000/auth/login` 發送 Magic Link
- [ ] 在 **同一個瀏覽器** 中點擊郵件連結
- [ ] 驗證成功重定向到 `/dashboard`
- [ ] 測試在不同瀏覽器中打開連結（應該導向 `/auth/error`）

### Production 測試
- [ ] 在 `https://family-mosaic-maker.vercel.app/auth/login` 發送 Magic Link
- [ ] 在 **同一個瀏覽器** 中點擊郵件連結
- [ ] 驗證成功重定向到 `/dashboard`
- [ ] 測試從 Preview 發送，在 Production 打開（應該導向 `/auth/error`）

---

## 🔍 除錯技巧

### 檢查 Cookies
在瀏覽器的 DevTools → Application → Cookies 中檢查：
- 應該有 Supabase 相關的 cookies（例如 `sb-*-auth-token`）
- 如果沒有，可能是 cookies 被清除或在不同 domain 中

### 檢查錯誤訊息
- `"both auth code and code verifier should be non-empty"`: PKCE cookie 缺失
- `"Invalid login credentials"`: 用戶不存在或密碼錯誤（不適用於 Magic Link）
- `"expired_token"`: Magic Link 已過期

### 檢查 Network 請求
在 DevTools → Network 中檢查：
- `/auth/callback?code=xxx` 請求的狀態碼
- 如果返回 302 重定向到 `/auth/error`，檢查重定向的 URL 參數

---

## 📚 相關文檔

- [Supabase PKCE Email Link 流程修復報告](../auth-pkce-fix-report.md)
- [Supabase Dashboard PKCE Email Link 設置 Checklist](../supabase-auth-pkce-checklist.md)
- [Supabase Auth URL Configuration Guide](../deploy/supabase-auth-urls.md)

---

**最後更新**: 2025-11-13



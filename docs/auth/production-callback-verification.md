# Production /auth/callback 行為驗證說明

**日期**: 2025-11-13  
**環境**: Production (family-mosaic-maker.vercel.app)

---

## 1. Production 環境下的所有 Redirect 行為

`app/auth/callback/route.ts` 在 Production 環境下，所有情況都會返回 `302 Found` redirect，**絕不會返回 JSON**。

### 情況 1: 缺少 `code` 參數

**URL**: `https://family-mosaic-maker.vercel.app/auth/callback`

**行為**:
- HTTP Status: `302 Found`
- Location: `https://family-mosaic-maker.vercel.app/auth/login?error=missing_code`
- 說明: 當 URL 中沒有 `code` 參數時，會 redirect 到登入頁面並帶上錯誤參數

### 情況 2: 有 `code` 但缺少 PKCE Cookie（例如 fake code 或不同瀏覽器）

**URL**: `https://family-mosaic-maker.vercel.app/auth/callback?code=fake-test-code`

**行為**:
- HTTP Status: `302 Found`
- Location: `https://family-mosaic-maker.vercel.app/auth/error?reason=missing_pkce_cookie`
- 說明: 當 `code` 存在但 Supabase 回傳 "both auth code and code verifier should be non-empty" 錯誤時，會 redirect 到錯誤頁面，並顯示 PKCE cookie 缺失的提示

### 情況 3: 正常成功登入

**URL**: `https://family-mosaic-maker.vercel.app/auth/callback?code=VALID_CODE&redirect=/dashboard`

**行為**:
- HTTP Status: `302 Found`
- Location: `https://family-mosaic-maker.vercel.app/dashboard`（或 `redirect` 參數指定的頁面）
- 說明: 當 `code` 有效且 PKCE cookie 存在時，成功交換 session 並 redirect 到目標頁面

### 情況 4: Code 無效或過期（其他錯誤）

**URL**: `https://family-mosaic-maker.vercel.app/auth/callback?code=EXPIRED_OR_INVALID_CODE`

**行為**:
- HTTP Status: `302 Found`
- Location: `https://family-mosaic-maker.vercel.app/auth/error?error=invalid_link`
- 說明: 當 `code` 無效、過期或發生其他錯誤時，會 redirect 到錯誤頁面

### 情況 5: 未預期的系統錯誤

**行為**:
- HTTP Status: `302 Found`
- Location: `https://family-mosaic-maker.vercel.app/auth/error?error=internal_error`
- 說明: 當發生未預期的系統錯誤時，會 redirect 到錯誤頁面

---

## 2. 給非工程師的操作說明

### 測試 1: 測試缺少 code 的 redirect

**步驟**:
1. 打開瀏覽器（Chrome、Safari、Firefox 等）
2. 在網址列輸入：`https://family-mosaic-maker.vercel.app/auth/callback`
3. 按 Enter
4. **預期結果**: 瀏覽器會自動跳轉到登入頁面（`/auth/login`），不會看到任何 JSON 錯誤訊息

**如何確認成功**: 網址會變成 `https://family-mosaic-maker.vercel.app/auth/login?error=missing_code`

---

### 測試 2: 測試 fake code 的 redirect

**步驟**:
1. 打開瀏覽器
2. 在網址列輸入：`https://family-mosaic-maker.vercel.app/auth/callback?code=fake-test-code`
3. 按 Enter
4. **預期結果**: 瀏覽器會自動跳轉到錯誤頁面（`/auth/error`），顯示「登入連結已失效」的提示，不會看到 JSON 錯誤訊息

**如何確認成功**: 網址會變成 `https://family-mosaic-maker.vercel.app/auth/error?reason=missing_pkce_cookie`，頁面上會顯示友好的錯誤訊息和「回登入頁重新寄信」按鈕

---

### 測試 3: 用 Email 實測 Magic Link 登入（完整流程）

**重要提醒**: 
- ⚠️ **必須使用同一個瀏覽器**：發送 Magic Link 和點擊連結都要在同一個瀏覽器
- ⚠️ **建議使用 Web 版信箱**：不要用 Mail App 或 Outlook App，建議用 Gmail Web、Outlook Web 等網頁版信箱

**步驟**:
1. 打開瀏覽器（例如 Chrome）
2. 訪問：`https://family-mosaic-maker.vercel.app/auth/login`
3. 輸入你的 Email 地址
4. 點擊「Send Magic Link」按鈕
5. **保持同一個瀏覽器開啟**，去檢查你的 Email
6. 在 **Web 版信箱**（例如 Gmail Web）中打開收到的驗證信
7. 點擊信中的「登入連結」或「Verify Email」按鈕
8. **預期結果**: 瀏覽器會自動跳轉到 `https://family-mosaic-maker.vercel.app/dashboard`，成功登入

**如果失敗了**:
- 如果看到錯誤頁面（`/auth/error`），可能是因為：
  - 在不同瀏覽器中打開了連結
  - 使用了 Mail App 而不是 Web 版信箱
  - 連結已過期
- **解決方法**: 回到登入頁面（`/auth/login`），重新發送 Magic Link，並確保在**同一個瀏覽器**和**Web 版信箱**中完成所有步驟

---

## 3. 確認聲明

✅ **只要 Vercel 上跑的是最新 commit（包含修正後的 `app/auth/callback/route.ts`），就不可能再看到 JSON 版的 `/auth/callback` 回應。所有情況都會返回 `302 Found` redirect，頂多只會看到錯誤頁（`/auth/error`）或登入頁（`/auth/login`），絕對不會看到 `{"error":"..."}` 這種 JSON 格式的錯誤訊息。**

---

## 技術細節（給工程師參考）

- **Handler**: `app/auth/callback/route.ts` 的 `GET` 函數
- **所有 return 語句**: 都是 `NextResponse.redirect(...)`，沒有任何 `NextResponse.json(...)`
- **錯誤處理**: 所有錯誤情況都通過 redirect 處理，不會直接返回錯誤 JSON
- **PKCE 流程**: 使用 `createServerClient` 從 `@supabase/ssr`，自動從 cookies 讀取 `code_verifier`


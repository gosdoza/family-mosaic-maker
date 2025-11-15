# Auth Edge Cases 人工驗收步驟

**版本**: v1.0.0  
**建立日期**: 2025-11-13  
**目標**: 提供需要人工用瀏覽器/Email 測試的 Auth Flow 邊界情境步驟

---

## 前置準備

1. **確保 Production 環境已部署最新版本**
   - 檢查 `/api/version` 確認 commit SHA
   - 確認所有新功能（/auth/logout、/auth/login server wrapper）已部署

2. **準備測試環境**
   - 準備 2 個不同的瀏覽器（例如：Chrome 和 Safari）
   - 或準備 2 個不同的裝置（例如：桌面和手機）
   - 準備一個測試用的 Email 地址

---

## S1. Magic link 重複點擊（同一瀏覽器）

### 測試步驟

1. **第一次點擊**
   - 造訪 `https://family-mosaic-maker.vercel.app/auth/login`
   - 輸入測試 Email 地址
   - 點擊「Send Magic Link」
   - 確認顯示「Magic Link Sent!」訊息
   - 檢查 Email 收件匣，找到 Supabase 寄來的 Magic Link
   - **第一次點擊** Magic Link
   - **預期結果**：
     - 成功登入
     - Redirect 到 `/dashboard`
     - 顯示 Dashboard 2.0 介面（3 個卡片）

2. **第二次點擊（同一封信）**
   - 回到 Email 收件匣
   - **第二次點擊**同一封 Magic Link
   - **預期結果**：
     - **選項 A**：如果 Supabase 認為 code 仍然有效
       - 更新 session（如果需要）
       - Redirect 到 `/dashboard`
       - 不顯示錯誤訊息
     - **選項 B**：如果 Supabase 認為 code 已被使用/無效
       - Redirect 到 `/auth/error?error=invalid_link`
       - 顯示「验证链接已失效或已过期」錯誤訊息
       - 提供「回登入页重新寄信」按鈕
     - **絕對不能**：看到 JSON error（例如 `{"error":"..."}`）

### 驗收標準

- ✅ 第一次點擊成功登入並導向 `/dashboard`
- ✅ 第二次點擊不會出現 JSON error
- ✅ 第二次點擊會 redirect 到 `/dashboard` 或 `/auth/error`，不會卡在 `/auth/callback`

---

## S2. Magic link 過期

### 測試步驟

1. **使用過期的 Magic Link**
   - 造訪 `https://family-mosaic-maker.vercel.app/auth/login`
   - 輸入測試 Email 地址
   - 點擊「Send Magic Link」
   - 等待 **超過 1 小時**（Supabase 預設 Magic Link 有效時間）
   - 或使用一個已知無效的 code（例如：`/auth/callback?code=expired-fake-code`）

2. **點擊過期連結**
   - 點擊過期的 Magic Link
   - **預期結果**：
     - Redirect 到 `/auth/error?error=invalid_link`
     - 顯示「验证链接已失效或已过期。请重新发送验证邮件。」
     - 提供「回登入页重新寄信」按鈕
     - **絕對不能**：看到 JSON error

### 驗收標準

- ✅ 過期連結會 redirect 到 `/auth/error?error=invalid_link`
- ✅ 錯誤訊息清楚說明連結已失效
- ✅ 提供重新發送連結的按鈕

---

## S3. 已登入的使用者再訪 /auth/login

### 測試步驟

1. **先登入**
   - 使用 Magic Link 成功登入
   - 確認目前在 `/dashboard`

2. **訪問 /auth/login**
   - 在瀏覽器網址列手動輸入：`https://family-mosaic-maker.vercel.app/auth/login`
   - 或點擊導航中的「Sign in」連結
   - **預期結果**：
     - **立即** redirect 到 `/dashboard`
     - 不顯示登入表單
     - 不會看到「已登入但還顯示登入頁」的混淆情況

### 驗收標準

- ✅ 已登入使用者訪問 `/auth/login` 會自動 redirect 到 `/dashboard`
- ✅ 不會顯示登入表單
- ✅ Redirect 是即時的（不會閃爍）

---

## S4. 已登入訪 /auth/callback

### 測試步驟

1. **先登入**
   - 使用 Magic Link 成功登入
   - 確認目前在 `/dashboard`

2. **發送另一封 Magic Link**
   - 造訪 `/auth/login`（應該會被 redirect 到 `/dashboard`，但可以從 Email 觸發）
   - 或使用另一個 Email 發送 Magic Link
   - 收到新的 Magic Link

3. **點擊新的 Magic Link（已登入狀態）**
   - 點擊新的 Magic Link
   - **預期結果**：
     - **選項 A**：如果 code 有效
       - Supabase 更新 session
       - Redirect 到 `/dashboard`
       - 不顯示錯誤（這是合法的「重新登入」行為）
     - **選項 B**：如果 code 無效/過期
       - Redirect 到 `/auth/error?error=invalid_link`
       - 顯示「連結已失效」訊息

### 驗收標準

- ✅ 已登入使用者點擊有效的 Magic Link 會更新 session 並 redirect 到 `/dashboard`
- ✅ 不會顯示錯誤（因為這是合法行為）
- ✅ 如果 code 無效，會正確顯示錯誤訊息

---

## S5. 遠端裝置點同一封 Magic link（PKCE cookie 不在同一瀏覽器）

### 測試步驟

1. **在裝置 A 請求 Magic Link**
   - 在 **Chrome（桌面）** 造訪 `https://family-mosaic-maker.vercel.app/auth/login`
   - 輸入測試 Email 地址
   - 點擊「Send Magic Link」
   - 確認顯示「Magic Link Sent!」訊息
   - **不要**在 Chrome 中點擊 Magic Link

2. **在裝置 B 點擊同一封 Magic Link**
   - 在 **Safari（或手機 Chrome）** 打開 Email 收件匣
   - 點擊同一封 Magic Link
   - **預期結果**：
     - Redirect 到 `/auth/error?reason=missing_pkce_cookie`
     - 顯示錯誤訊息：「驗證連結無法使用，請確認：寄信與點信使用同一個瀏覽器／同一個裝置，且不是用 Mail App 或 Outlook App 開啟。建議改用 Web 版信箱（例如 Gmail / Outlook Web）重新點擊連結。」
     - 提供「回登入页重新寄信」按鈕
     - **絕對不能**：看到 JSON error

### 驗收標準

- ✅ 跨瀏覽器/跨裝置點擊會 redirect 到 `/auth/error?reason=missing_pkce_cookie`
- ✅ 錯誤訊息清楚說明需要使用同一瀏覽器
- ✅ 提供解決方案建議（使用 Web 版信箱）

---

## S6. 登出（Logout）

### 測試步驟

1. **先登入**
   - 使用 Magic Link 成功登入
   - 確認目前在 `/dashboard`

2. **點擊 Sign out 按鈕**
   - 在 Dashboard 的「Your Account」卡片中找到「Sign out」按鈕
   - 點擊「Sign out」按鈕
   - **預期結果**：
     - Redirect 到首頁 (`/`)
     - Session 被清除（所有 Supabase cookies 被刪除）

3. **驗證登出成功**
   - 手動訪問 `/dashboard`
   - **預期結果**：
     - Redirect 到 `/auth/login`
     - 不會顯示 Dashboard 內容

4. **驗證 Sign out 按鈕位置**
   - 確認「Sign out」按鈕在 Dashboard 的「Your Account」卡片中
   - 確認按鈕樣式清楚（outline variant，有 LogOut 圖示）

### 驗收標準

- ✅ Sign out 按鈕在 Dashboard 中可見且可用
- ✅ 點擊 Sign out 後 redirect 到首頁
- ✅ Session 被正確清除（訪問 `/dashboard` 會被 redirect 到 `/auth/login`）
- ✅ 不會出現錯誤或卡在登出流程

---

## 快速驗收檢查清單

完成所有測試後，確認以下項目：

- [ ] S1: Magic link 重複點擊不會出現 JSON error
- [ ] S2: Magic link 過期會顯示清楚錯誤訊息
- [ ] S3: 已登入使用者訪問 `/auth/login` 會自動 redirect
- [ ] S4: 已登入使用者點擊 Magic Link 會更新 session
- [ ] S5: 跨瀏覽器/跨裝置會顯示 PKCE 錯誤訊息
- [ ] S6: Sign out 功能正常運作，session 被正確清除

---

## 注意事項

1. **測試環境**
   - 建議在 Production 環境測試（`https://family-mosaic-maker.vercel.app`）
   - 確保已部署最新版本（檢查 `/api/version`）

2. **Email 測試**
   - 使用真實的 Email 地址（不要使用假地址）
   - 確認能收到 Supabase 寄來的 Magic Link
   - 建議使用 Gmail 或 Outlook Web 版信箱（避免 Mail App 的問題）

3. **瀏覽器測試**
   - 測試時使用不同的瀏覽器（Chrome、Safari、Firefox）
   - 測試時使用不同的裝置（桌面、手機）
   - 清除 cookies 後重新測試（確保測試環境乾淨）

4. **錯誤處理**
   - 所有錯誤情況都應該 redirect，**絕對不能**出現 JSON error
   - 錯誤訊息應該清楚說明問題與解決方法
   - 所有錯誤頁面都應該提供「回登入页重新寄信」按鈕

---

## 疑難排解

### 問題：Magic Link 點擊後還是看到 JSON error

**可能原因**：
- `/auth/callback` 沒有正確處理錯誤
- Supabase 配置問題

**解決方法**：
- 檢查 `/auth/callback/route.ts` 是否所有錯誤都 redirect
- 確認 Supabase Dashboard 中的 Redirect URLs 設定正確

### 問題：已登入使用者訪問 `/auth/login` 沒有 redirect

**可能原因**：
- `/auth/login/page.tsx` 沒有正確檢查 session
- Server component 沒有正確執行

**解決方法**：
- 確認 `/auth/login/page.tsx` 是 server component
- 確認 `getCurrentUser()` 正確運作

### 問題：Sign out 按鈕找不到

**可能原因**：
- Dashboard 2.0 尚未部署
- 按鈕位置不明顯

**解決方法**：
- 確認 Dashboard 2.0 已部署
- 檢查「Your Account」卡片中是否有「Sign out」按鈕


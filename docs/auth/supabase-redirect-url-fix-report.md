# Supabase Auth Redirect URL 完整修復報告

**生成日期**: 2025-11-13  
**問題**: PKCE cookie 無法對齊導致回傳 JSON 錯誤

---

## 1. 正確 Domain 配置

### 唯一正確的 Production Domain

**`family-mosaic-maker.vercel.app`**

這是 Production 環境的唯一正確 domain，所有 Supabase Auth 配置都應該基於此 domain。

---

## 2. Supabase Dashboard 應設定的 Redirect URLs

### ✅ 必須存在的 Redirect URLs（3 個）

在 Supabase Dashboard → Authentication → URL Configuration → Redirect URLs 中，**只應該存在以下 3 個 URL**：

1. **Production 回調 URL**:
   ```
   https://family-mosaic-maker.vercel.app/auth/callback
   ```

2. **Preview 通配符回調 URL**:
   ```
   https://family-mosaic-maker-*.vercel.app/auth/callback
   ```
   - 說明: `*` 通配符匹配所有 Preview 部署（例如 `family-mosaic-maker-abc123.vercel.app`）

3. **本地開發回調 URL**:
   ```
   http://localhost:3000/auth/callback
   ```

### ❌ 不應該存在的 Redirect URLs

以下 URL **應該被刪除**（如果存在）：

1. ❌ `https://family-mosaic-maker.vercel.app`（只有根 domain，缺少 `/auth/callback` 路徑）
2. ❌ `https://family-mosaic-maker.vercel.app/*`（過於寬鬆的通配符，不安全）
3. ❌ `https://family-mosaic-maker-*.vercel.app/*`（過於寬鬆的通配符，不安全）
4. ❌ `http://localhost:3000`（只有根 domain，缺少 `/auth/callback` 路徑）
5. ❌ 任何其他未列出的 URL

---

## 3. Site URL 配置

### ✅ 正確的 Site URL

在 Supabase Dashboard → Authentication → URL Configuration → Site URL 中，應該設定為：

```
https://family-mosaic-maker.vercel.app
```

**重要**: 
- ✅ 必須是完整的 URL（包含 `https://`）
- ✅ 必須是 Production domain（`family-mosaic-maker.vercel.app`）
- ❌ 不要使用 `http://localhost:3000`（這是開發環境用的，不應該在 Production Site URL 中）

---

## 4. 程式碼中的 Redirect URL 配置

### ✅ 當前配置（正確）

**檔案**: `app/auth/login/page.tsx`

```typescript
const emailRedirectTo = `${window.location.origin}/auth/callback`
```

**分析**:
- ✅ **正確**: 使用 `window.location.origin` 動態獲取當前 domain
- ✅ **正確**: 自動適應不同環境（localhost、preview、production）
- ✅ **正確**: 不需要從環境變數讀取，避免配置錯誤

**為什麼這樣做是正確的**:
- 當用戶在 `https://family-mosaic-maker.vercel.app/auth/login` 發送 Magic Link 時，`window.location.origin` 會是 `https://family-mosaic-maker.vercel.app`
- 當用戶在 `http://localhost:3000/auth/login` 發送 Magic Link 時，`window.location.origin` 會是 `http://localhost:3000`
- 這樣可以確保 `emailRedirectTo` 始終與當前訪問的 domain 一致，避免 PKCE cookie 無法對齊的問題

### ❌ 不需要的環境變數

**不需要設定以下環境變數**（程式碼中沒有使用）:
- `DOMAIN`（雖然在 Vercel 環境變數中可能存在，但程式碼中沒有使用）
- `NEXT_PUBLIC_SITE_URL`（程式碼中沒有使用）
- `SITE_URL`（程式碼中沒有使用）

---

## 5. Vercel 環境變數檢查

### 檢查 Vercel 環境變數

雖然程式碼中不使用 `DOMAIN` 環境變數，但為了其他用途（例如其他功能），建議檢查 Vercel 環境變數：

**Preview 環境**:
```bash
vercel env pull .env.vercel.preview --environment=preview
```

**Production 環境**:
```bash
vercel env pull .env.vercel.prod --environment=production
```

**預期的 `DOMAIN` 值**:
- Preview: `https://family-mosaic-maker-xxxxx.vercel.app`（動態的 Preview URL）
- Production: `https://family-mosaic-maker.vercel.app`

**注意**: 即使 `DOMAIN` 環境變數設定錯誤，也不會影響 Supabase Auth 的 redirect URL，因為程式碼使用 `window.location.origin`。

---

## 6. 錯誤 URL 的來源分析

### 可能的錯誤配置來源

1. **過時的文檔或配置**:
   - 某些文檔中可能提到 `https://family-mosaic-maker.vercel.app/*` 這種過於寬鬆的通配符
   - 某些文檔中可能提到 `http://localhost:3000` 作為 Site URL（這只適用於開發環境）

2. **Supabase Dashboard 中的舊配置**:
   - 可能之前添加了過多的 Redirect URLs
   - 可能 Site URL 設定為 `http://localhost:3000`（應該改為 Production domain）

3. **環境變數誤用**:
   - 雖然程式碼中沒有使用 `DOMAIN` 環境變數，但如果之前有嘗試使用，可能導致混淆

---

## 7. 修復步驟

### Step 1: 檢查 Supabase Dashboard 配置

1. 訪問 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇專案
3. 進入 **Settings** → **Authentication** → **URL Configuration**

### Step 2: 設定 Site URL

**設定為**:
```
https://family-mosaic-maker.vercel.app
```

### Step 3: 清理 Redirect URLs

**刪除所有現有的 Redirect URLs**，然後**只添加以下 3 個**:

1. `https://family-mosaic-maker.vercel.app/auth/callback`
2. `https://family-mosaic-maker-*.vercel.app/auth/callback`
3. `http://localhost:3000/auth/callback`

### Step 4: 驗證配置

執行以下命令驗證配置：

```bash
# 測試 Production callback（應該返回 302 redirect）
curl -I "https://family-mosaic-maker.vercel.app/auth/callback?code=fake-test-code"

# 預期結果:
# HTTP/2 302
# location: https://family-mosaic-maker.vercel.app/auth/error?reason=missing_pkce_cookie
```

---

## 8. 是否需要更新程式碼或環境變數

### ✅ 程式碼：不需要更新

**原因**:
- `app/auth/login/page.tsx` 已經使用 `window.location.origin`，這是正確的做法
- `app/auth/callback/route.ts` 已經正確處理所有 redirect 情況

### ⚠️ 環境變數：可選檢查

**建議**:
- 檢查 Vercel 環境變數中的 `DOMAIN` 是否正確（雖然程式碼不使用，但可能其他功能會用到）
- 如果 `DOMAIN` 設定錯誤，建議修正，但不影響 Supabase Auth 功能

---

## 9. 是否需要重新部署

### ❌ 不需要重新部署

**原因**:
- 程式碼已經正確，使用 `window.location.origin` 動態獲取 domain
- 只需要在 Supabase Dashboard 中修正配置即可

**但是**:
- 如果之前部署的版本有問題，建議確認 Vercel 上運行的是最新 commit
- 可以執行 `vercel --prod` 確保 Production 環境是最新版本

---

## 10. 驗證流程

### 驗證步驟

1. **修正 Supabase Dashboard 配置**（按照 Step 1-3）

2. **測試 Production Magic Link 登入**:
   - 訪問 `https://family-mosaic-maker.vercel.app/auth/login`
   - 輸入 Email，發送 Magic Link
   - 在**同一個瀏覽器**中打開 Email（建議使用 Web 版信箱）
   - 點擊 Magic Link
   - **預期**: 成功 redirect 到 `/dashboard`，不會看到 JSON 錯誤

3. **測試 Preview Magic Link 登入**:
   - 訪問 Preview URL（例如 `https://family-mosaic-maker-abc123.vercel.app/auth/login`）
   - 重複上述步驟
   - **預期**: 成功 redirect 到 `/dashboard`

4. **測試本地開發**:
   - 訪問 `http://localhost:3000/auth/login`
   - 重複上述步驟
   - **預期**: 成功 redirect 到 `/dashboard`

---

## 11. 總結

### ✅ 正確配置

1. **Supabase Dashboard Site URL**: `https://family-mosaic-maker.vercel.app`
2. **Supabase Dashboard Redirect URLs**: 只包含 3 個 URL（見第 2 節）
3. **程式碼**: 使用 `window.location.origin`，不需要修改
4. **環境變數**: 不需要為 Supabase Auth 設定特殊環境變數

### ❌ 需要修正

1. **刪除多餘的 Redirect URLs**（如果存在）
2. **確認 Site URL 設定為 Production domain**（不是 `http://localhost:3000`）

### 🎯 關鍵要點

- **PKCE cookie 對齊的關鍵**: `emailRedirectTo` 必須與當前訪問的 domain 完全一致
- **為什麼使用 `window.location.origin`**: 自動適應不同環境，避免配置錯誤
- **為什麼不需要環境變數**: 動態獲取比靜態配置更可靠

---

**修復完成後，PKCE cookie 應該能夠正確對齊，不再出現 JSON 錯誤。**


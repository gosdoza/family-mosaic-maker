# Magic Link Site URL 配置说明

**日期**: 2025-11-13

---

## 為什麼我們改成使用 NEXT_PUBLIC_SITE_URL

### 問題背景

之前使用 `window.location.origin` 作為 `emailRedirectTo` 的 base URL，導致：

- 當用戶在 Preview domain（例如 `https://family-mosaic-maker-abc123.vercel.app`）訪問登入頁時
- Magic Link 的 `redirect_to` 會指向 Preview domain：`https://family-mosaic-maker-abc123.vercel.app/auth/callback`
- 這會導致 PKCE cookie 無法對齊，因為 Supabase Dashboard 中配置的 Redirect URLs 是正式 domain

### 解決方案

改用 `NEXT_PUBLIC_SITE_URL` 環境變數作為 base URL：

- **無論在哪裡部署**（Preview / Production），Magic Link 都指向正式 domain
- 確保 `redirect_to` 始終為：`https://family-mosaic-maker.vercel.app/auth/callback`
- 避免 PKCE cookie 對齊問題

---

## 正確的設定示例

### 本地開發

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Vercel Preview

```bash
NEXT_PUBLIC_SITE_URL=https://family-mosaic-maker.vercel.app
```

**注意**: Preview 環境也建議設定為正式 domain，而不是 preview domain。

### Vercel Production

```bash
NEXT_PUBLIC_SITE_URL=https://family-mosaic-maker.vercel.app
```

---

## 程式碼實作

在 `app/auth/login/page.tsx` 中：

```typescript
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "")
const emailRedirectTo = `${siteUrl}/auth/callback`
```

**Fallback 機制**:
- 優先使用 `NEXT_PUBLIC_SITE_URL` 環境變數
- 如果未設定，fallback 到 `window.location.origin`（用於本地開發）

---

## 檢查與驗證

### 如何檢查 Magic Link 是否正確

1. 訪問登入頁面（可以是 Preview 或 Production URL）
2. 輸入 Email，發送 Magic Link
3. 檢查收到的 Email 中的 Magic Link
4. 查看 `redirect_to` 參數的值

**正確的 Magic Link 範例**:
```
https://mxdexoahfmwbqwngzzsf.supabase.co/auth/v1/verify?token=xxx&type=magiclink&redirect_to=https://family-mosaic-maker.vercel.app/auth/callback
```

**錯誤的 Magic Link 範例**（包含 preview domain）:
```
https://mxdexoahfmwbqwngzzsf.supabase.co/auth/v1/verify?token=xxx&type=magiclink&redirect_to=https://family-mosaic-maker-abc123.vercel.app/auth/callback
```

---

## 故障排除

### 如果收到的 Magic Link 裡的 redirect_to 包含 preview 子網域

**可能原因**:
1. `NEXT_PUBLIC_SITE_URL` 環境變數未設定
2. `NEXT_PUBLIC_SITE_URL` 設定為 preview domain
3. 程式碼未正確讀取環境變數

**解決方法**:
1. 檢查 Vercel Dashboard → Project → Settings → Environment Variables
2. 確認 `NEXT_PUBLIC_SITE_URL` 已設定為 `https://family-mosaic-maker.vercel.app`
3. 確認 Preview 和 Production 環境都有設定
4. 重新部署應用

---

## 一句話提醒

**如果你收到的 Supabase magic link 裡的 `redirect_to` 包含 preview 子網域，那就代表環境變數或登入網址用錯，請檢查 `NEXT_PUBLIC_SITE_URL`。**


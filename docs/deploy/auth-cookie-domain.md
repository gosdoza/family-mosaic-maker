# Cookie/Domain 與跨環境跳轉一致性說明

本文档说明 Cookie 和 Domain 的配置，以及跨环境跳转的一致性问题。

## 🔒 Cookie 域限制

### Cookie 僅在各自網域生效

**重要原則:**
- ✅ **Production Cookie**: 僅在 `https://family-mosaic-maker.vercel.app` 生效
- ✅ **Preview Cookie**: 僅在各自的 Preview 網域生效（如 `https://family-mosaic-maker-abc123.vercel.app`）
- ❌ **跨域 Cookie**: Cookie 無法跨不同網域共享

**技術說明:**
- Supabase Auth 使用 HTTP-only cookies 存儲 session
- Cookie 的 `domain` 屬性綁定到特定網域
- 每個 Preview 部署都有獨立的網域，因此有獨立的 Cookie 存儲

### Cookie 設定方式

**Supabase Auth Cookie:**
- Cookie 名稱: `sb-<project-ref>-auth-token`
- Domain: 綁定到當前網域（自動設定）
- HttpOnly: `true`（安全設定）
- Secure: `true`（僅 HTTPS）
- SameSite: `lax` 或 `strict`

**範例:**
```
# Production
Domain: family-mosaic-maker.vercel.app
Cookie: sb-mxdexoahfmwbqwngzzsf-auth-token

# Preview
Domain: family-mosaic-maker-abc123.vercel.app
Cookie: sb-mxdexoahfmwbqwngzzsf-auth-token
```

## ⚠️ 跨環境問題

### 問題場景

**場景 1: 從 Preview 發送 Magic Link，在 Production 打開**

1. 用戶在 Preview 部署 (`https://family-mosaic-maker-abc123.vercel.app`) 發起 Magic Link 登入
2. 收到郵件，點擊 Magic Link
3. **錯誤**: 如果在 Production 網域 (`https://family-mosaic-maker.vercel.app`) 打開郵件連結
4. **結果**: 認證失敗，因為：
   - Magic Link 中的 `code` 是為 Preview 網域生成的
   - Production 網域無法驗證 Preview 網域的認證碼
   - Cookie 無法跨域共享

**場景 2: 從 Production 發送 Magic Link，在 Preview 打開**

1. 用戶在 Production 部署發起 Magic Link 登入
2. 收到郵件，點擊 Magic Link
3. **錯誤**: 如果在 Preview 網域打開郵件連結
4. **結果**: 認證失敗，原因同上

### 為什麼會失敗？

1. **認證碼綁定網域:**
   - Supabase 生成的認證碼 (`code`) 綁定到發送 Magic Link 的網域
   - 認證碼只能在原始網域使用

2. **Cookie 域限制:**
   - Session cookie 僅在發送 Magic Link 的網域有效
   - 無法跨域共享

3. **Redirect URL 驗證:**
   - Supabase 驗證 Redirect URL 必須匹配允許的回調 URL
   - 跨域重定向會被拒絕

## ✅ 解決方案

### 1. 避免跨環境打開信件

**最佳實踐:**
- ✅ 在發送 Magic Link 的同一環境中打開郵件
- ✅ 如果從 Preview 發送，在 Preview 網域打開
- ✅ 如果從 Production 發送，在 Production 網域打開

### 2. UI 提示字樣

**建議在登入頁面顯示提示:**

```tsx
// 在 /app/auth/login/page.tsx 中添加
{process.env.NEXT_PUBLIC_USE_MOCK === "true" && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
    <p className="text-sm text-yellow-800">
      ⚠️ <strong>注意:</strong> 這是 Preview 環境。請確保在發送 Magic Link 的同一網域中打開郵件連結。
    </p>
  </div>
)}
```

**提示內容建議:**
- Preview 環境: "這是 Preview 環境，請在發送 Magic Link 的同一網域中打開郵件"
- Production 環境: "請確保在 Production 網域中打開郵件連結"

### 3. 郵件內容提示

**建議在 Magic Link 郵件中包含:**
- 發送網域信息
- 提醒用戶在正確的網域中打開連結
- 如果誤點，提供重新發送的選項

### 4. 錯誤處理

**在 Callback Handler 中處理跨域錯誤:**

```typescript
// app/auth/callback/route.ts
// 如果認證失敗，檢查是否為跨域問題
if (error && error.message.includes('redirect_uri')) {
  // 顯示友好的錯誤訊息
  return new NextResponse(
    JSON.stringify({ 
      error: "跨環境認證失敗。請在發送 Magic Link 的同一網域中打開連結。",
      hint: "如果您在 Preview 發送，請在 Preview 網域打開；如果在 Production 發送，請在 Production 網域打開。"
    }),
    {
      status: 422,
      headers: { "content-type": "application/json" },
    }
  )
}
```

## 📋 環境對應表

| 環境 | 網域 | Cookie 域 | Magic Link 回調 |
|------|------|-----------|----------------|
| Production | `https://family-mosaic-maker.vercel.app` | `family-mosaic-maker.vercel.app` | `https://family-mosaic-maker.vercel.app/auth/callback` |
| Preview | `https://family-mosaic-maker-*.vercel.app` | `family-mosaic-maker-*.vercel.app` | `https://family-mosaic-maker-*.vercel.app/auth/callback` |
| Development | `http://localhost:3000` | `localhost` | `http://localhost:3000/auth/callback` |

## ⚠️ 注意事項

### 跨環境打開信件會失敗

**重要提醒:**
- ❌ **不要**從 Preview 發送 Magic Link，然後在 Production 打開
- ❌ **不要**從 Production 發送 Magic Link，然後在 Preview 打開
- ✅ **必須**在發送 Magic Link 的同一網域中打開郵件連結

**失敗原因:**
1. 認證碼 (`code`) 綁定到發送網域
2. Cookie 無法跨域共享
3. Redirect URL 驗證失敗

### 開發建議

1. **測試時:**
   - 在 Preview 環境測試時，確保在 Preview 網域中打開 Magic Link
   - 在 Production 環境測試時，確保在 Production 網域中打開 Magic Link

2. **用戶體驗:**
   - 在 UI 中明確標示當前環境（Preview/Production）
   - 提供清晰的提示，避免用戶跨環境操作

3. **錯誤處理:**
   - 捕獲跨域認證錯誤
   - 提供友好的錯誤訊息和解決方案

## 🔍 故障排除

### 問題: Magic Link 認證失敗

**可能原因:**
1. 跨環境打開信件（最常見）
2. 認證碼過期
3. Redirect URL 未配置

**解決方法:**
1. 確認在發送 Magic Link 的同一網域中打開連結
2. 檢查認證碼是否在有效期內（5-10 分鐘）
3. 驗證 Supabase Redirect URLs 配置正確

### 問題: Cookie 未設置

**可能原因:**
1. 跨域問題
2. Cookie 設定不正確
3. 瀏覽器阻止 Cookie

**解決方法:**
1. 確認在正確的網域中操作
2. 檢查 Cookie 設定（HttpOnly, Secure, SameSite）
3. 檢查瀏覽器 Cookie 設定

## 📚 相關文檔

- [Supabase Auth 配置狀態](./supabase-auth-config-status.md)
- [Supabase Auth URL 配置](./supabase-auth-urls.md)
- [Auth Redirect 測試說明](../tests/auth-redirect.md)

## 🎯 最佳實踐總結

1. **環境一致性:**
   - 在發送 Magic Link 的同一環境中打開郵件
   - 避免跨環境操作

2. **用戶提示:**
   - 在 UI 中明確標示當前環境
   - 提供清晰的跨環境警告

3. **錯誤處理:**
   - 捕獲跨域認證錯誤
   - 提供友好的錯誤訊息和解決方案

4. **測試驗證:**
   - 在各自環境中測試認證流程
   - 驗證 Cookie 正確設置




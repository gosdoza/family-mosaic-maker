# /auth/callback 修正摘要

**日期**: 2025-11-13

## 問題確認

本機測試確認 `/auth/callback` 現在**正確返回 redirect**，不再返回 JSON。

## 測試結果

### 測試 1: 缺少 PKCE cookie（fake code）
```bash
curl -i "http://localhost:3000/auth/callback?code=fake-test-code"
```

**結果**:
- HTTP Status: `302 Found`
- Location: `http://localhost:3000/auth/error?reason=missing_pkce_cookie`
- ✅ 正確 redirect，沒有 JSON 回應

### 測試 2: 缺少 code 參數
```bash
curl -i "http://localhost:3000/auth/callback"
```

**結果**:
- HTTP Status: `302 Found`
- Location: `http://localhost:3000/auth/login?error=missing_code`
- ✅ 正確 redirect，沒有 JSON 回應

## 修正內容

### 檔案: `app/auth/callback/route.ts`

**關鍵修正**:
1. ✅ 所有 code path 都明確返回 `NextResponse.redirect(...)`
2. ✅ 在 error 處理中，每個分支都明確 return redirect（避免 fallthrough）
3. ✅ 完全沒有任何 `NextResponse.json` 或 JSON 回應

**行為邏輯**:
- 缺少 code → `302` → `/auth/login?error=missing_code`
- PKCE cookie 缺失 → `302` → `/auth/error?reason=missing_pkce_cookie`
- 其他錯誤 → `302` → `/auth/error?error=invalid_link`
- 成功 → `302` → `/dashboard` 或 `redirect` 參數

## 結論

本機 `/auth/callback` 現在**完全正確**，所有情況都返回 redirect，不會再返回 JSON。

**下一步**: 重新部署到 Vercel，然後用實際 email 測試完整登入流程。


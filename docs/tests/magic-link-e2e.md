# Magic Link E2E 測試說明

本文档描述 Magic Link 端到端測試流程，包括本地、Preview 和 Production 環境的測試步驟。

## 📋 測試環境

### 環境配置

| 環境 | URL | NEXT_PUBLIC_USE_MOCK | 說明 |
|------|-----|---------------------|------|
| 本地 | `http://localhost:3000` | `false` | 本地開發環境 |
| Preview | `https://family-mosaic-maker-*.vercel.app` | `true` | Preview 部署 |
| Production | `https://family-mosaic-maker.vercel.app` | `false` | Production 部署 |

## 🔒 重要注意事項

### ⚠️ 不可跨環境點信

**重要原則:**
- ❌ **不要**從 Preview 發送 Magic Link，然後在 Production 打開
- ❌ **不要**從 Production 發送 Magic Link，然後在 Preview 打開
- ✅ **必須**在發送 Magic Link 的同一網域中打開郵件連結

**失敗原因:**
1. 認證碼 (`code`) 綁定到發送 Magic Link 的網域
2. Cookie 無法跨域共享
3. Redirect URL 驗證失敗

**相關文檔:**
- [Cookie/Domain 與跨環境跳轉一致性說明](../deploy/auth-cookie-domain.md)

## 🧪 測試流程

### 1. 本地測試流程 (NEXT_PUBLIC_USE_MOCK=false)

#### 前置條件

1. **環境變數配置:**
   ```bash
   # .env.local
   NEXT_PUBLIC_USE_MOCK=false
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

2. **啟動本地服務器:**
   ```bash
   NEXT_PUBLIC_USE_MOCK=false pnpm dev
   ```

3. **確認服務器運行:**
   - 訪問 `http://localhost:3000`
   - 確認頁面正常載入

#### 測試步驟

**步驟 1: 訪問登入頁面**
1. 打開瀏覽器，訪問 `http://localhost:3000/auth/login`
2. 確認登入頁面正常顯示
3. 確認表單包含 Email 輸入框和「Send Magic Link」按鈕

**步驟 2: 發送 Magic Link**
1. 在 Email 輸入框中輸入測試信箱（建議使用一次性測試信箱）
   - 範例: `test-$(date +%s)@example.com`
   - 或使用: `test@example.com`（如果已配置）
2. 點擊「Send Magic Link」按鈕
3. 確認顯示「Magic Link Sent!」訊息
4. 確認沒有錯誤訊息

**步驟 3: 檢查郵件**
1. 打開測試信箱的收件箱
2. 查找來自 Supabase 的 Magic Link 郵件
3. 確認郵件包含登入連結
4. 確認連結指向 `http://localhost:3000/auth/callback?code=...`

**步驟 4: 點擊 Magic Link**
1. 點擊郵件中的 Magic Link
2. 確認瀏覽器重定向到 `http://localhost:3000/auth/callback?code=...`
3. 確認成功重定向到 `/orders` 或指定的 `redirect` 參數頁面
4. 確認已登入（可以訪問受保護路由）

**步驟 5: 驗證登入狀態**
1. 訪問 `http://localhost:3000/orders`
2. 確認可以正常訪問（不應重定向到登入頁面）
3. 訪問 `http://localhost:3000/settings`
4. 確認可以正常訪問
5. 訪問 `http://localhost:3000/results`
6. 確認可以正常訪問

#### 驗收標準

- ✅ 可以成功發送 Magic Link
- ✅ 可以收到 Magic Link 郵件
- ✅ 可以成功點擊 Magic Link 並登入
- ✅ 可以訪問受保護路由（/orders, /settings, /results）
- ✅ 不會重定向到登入頁面

#### 驗收命令

```bash
# 啟動本地服務器（非 mock）
NEXT_PUBLIC_USE_MOCK=false pnpm dev

# 手動：打開 http://localhost:3000/auth/login
# 發送並點擊 Magic Link，回到 /orders 即為通過
```

### 2. Preview 測試流程 (NEXT_PUBLIC_USE_MOCK=true)

#### 前置條件

1. **確認 Preview 部署:**
   ```bash
   vercel ls
   # 獲取 Preview URL
   ```

2. **確認環境變數:**
   - Preview 環境應設置 `NEXT_PUBLIC_USE_MOCK=true`
   - 確認 Supabase 配置正確

#### 測試步驟

**步驟 1: 訪問 Preview 登入頁面**
1. 打開瀏覽器，訪問 Preview URL（如 `https://family-mosaic-maker-abc123.vercel.app/auth/login`）
2. 確認登入頁面正常顯示
3. 確認顯示 Preview 環境提示（如果已實現）

**步驟 2: 發送 Magic Link**
1. 在 Email 輸入框中輸入**一次性測試信箱**
   - ⚠️ **重要**: 使用一次性測試信箱，避免與 Production 混淆
   - 範例: `preview-test-$(date +%s)@example.com`
2. 點擊「Send Magic Link」按鈕
3. 確認顯示「Magic Link Sent!」訊息
4. 確認沒有錯誤訊息

**步驟 3: 檢查郵件**
1. 打開測試信箱的收件箱
2. 查找來自 Supabase 的 Magic Link 郵件
3. 確認郵件包含登入連結
4. 確認連結指向 Preview URL（如 `https://family-mosaic-maker-abc123.vercel.app/auth/callback?code=...`）

**步驟 4: 點擊 Magic Link**
1. ⚠️ **重要**: 確保在 Preview 網域中打開 Magic Link
2. 點擊郵件中的 Magic Link
3. 確認瀏覽器重定向到 Preview URL 的 `/auth/callback?code=...`
4. 確認成功重定向到 `/orders` 或指定的 `redirect` 參數頁面
5. 確認已登入（可以訪問受保護路由）

**步驟 5: 驗證登入狀態**
1. 訪問 Preview URL 的 `/orders`
2. 確認可以正常訪問（不應重定向到登入頁面）
3. 訪問 Preview URL 的 `/settings`
4. 確認可以正常訪問
5. 訪問 Preview URL 的 `/results`
6. 確認可以正常訪問

#### 驗收標準

- ✅ 可以成功發送 Magic Link
- ✅ 可以收到 Magic Link 郵件
- ✅ 可以成功點擊 Magic Link 並登入
- ✅ 可以訪問受保護路由（/orders, /settings, /results）
- ✅ 不會重定向到登入頁面
- ✅ 在 Preview 網域中完成所有操作（不跨環境）

#### 驗收命令

```bash
# 獲取 Preview URL
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)

# 手動：打開 $PREVIEW_URL/auth/login
# 發送並點擊 Magic Link，回到 /orders 即為通過
# ⚠️ 注意：必須在 Preview 網域中打開 Magic Link
```

### 3. Production 測試流程 (NEXT_PUBLIC_USE_MOCK=false)

#### 前置條件

1. **確認 Production 部署:**
   - 訪問 `https://family-mosaic-maker.vercel.app`
   - 確認頁面正常載入

2. **確認環境變數:**
   - Production 環境應設置 `NEXT_PUBLIC_USE_MOCK=false`
   - 確認 Supabase 配置正確

#### 測試步驟

**步驟 1: 訪問 Production 登入頁面**
1. 打開瀏覽器，訪問 `https://family-mosaic-maker.vercel.app/auth/login`
2. 確認登入頁面正常顯示
3. 確認沒有 Preview 環境提示

**步驟 2: 發送 Magic Link**
1. 在 Email 輸入框中輸入**一次性測試信箱**
   - ⚠️ **重要**: 使用一次性測試信箱，避免與 Preview 混淆
   - 範例: `prod-test-$(date +%s)@example.com`
2. 點擊「Send Magic Link」按鈕
3. 確認顯示「Magic Link Sent!」訊息
4. 確認沒有錯誤訊息

**步驟 3: 檢查郵件**
1. 打開測試信箱的收件箱
2. 查找來自 Supabase 的 Magic Link 郵件
3. 確認郵件包含登入連結
4. 確認連結指向 Production URL（如 `https://family-mosaic-maker.vercel.app/auth/callback?code=...`）

**步驟 4: 點擊 Magic Link**
1. ⚠️ **重要**: 確保在 Production 網域中打開 Magic Link
2. 點擊郵件中的 Magic Link
3. 確認瀏覽器重定向到 Production URL 的 `/auth/callback?code=...`
4. 確認成功重定向到 `/orders` 或指定的 `redirect` 參數頁面
5. 確認已登入（可以訪問受保護路由）

**步驟 5: 驗證登入狀態**
1. 訪問 `https://family-mosaic-maker.vercel.app/orders`
2. 確認可以正常訪問（不應重定向到登入頁面）
3. 訪問 `https://family-mosaic-maker.vercel.app/settings`
4. 確認可以正常訪問
5. 訪問 `https://family-mosaic-maker.vercel.app/results`
6. 確認可以正常訪問

#### 驗收標準

- ✅ 可以成功發送 Magic Link
- ✅ 可以收到 Magic Link 郵件
- ✅ 可以成功點擊 Magic Link 並登入
- ✅ 可以訪問受保護路由（/orders, /settings, /results）
- ✅ 不會重定向到登入頁面
- ✅ 在 Production 網域中完成所有操作（不跨環境）

#### 驗收命令

```bash
# 手動：打開 https://family-mosaic-maker.vercel.app/auth/login
# 發送並點擊 Magic Link，回到 /orders 即為通過
# ⚠️ 注意：必須在 Production 網域中打開 Magic Link
```

## ⚠️ 異常處理

### 1. 信件延遲

**問題描述:**
- Magic Link 郵件未及時收到
- 郵件可能被歸類為垃圾郵件

**解決方法:**
1. **檢查垃圾郵件資料夾:**
   - 檢查測試信箱的垃圾郵件資料夾
   - 確認郵件未被過濾

2. **等待時間:**
   - 通常 Magic Link 郵件會在 1-2 分鐘內到達
   - 如果超過 5 分鐘仍未收到，檢查 Supabase 配置

3. **重新發送:**
   - 如果郵件未收到，可以重新發送 Magic Link
   - 確認 Email 地址正確

4. **檢查 Supabase 配置:**
   - 確認 Supabase Email 發送配置正確
   - 檢查 Supabase Dashboard 中的 Email 設定

### 2. 連結過期

**問題描述:**
- Magic Link 連結已過期
- 點擊連結後返回錯誤

**解決方法:**
1. **檢查連結有效期:**
   - Magic Link 通常有效期為 5-10 分鐘
   - 如果連結已過期，需要重新發送

2. **重新發送 Magic Link:**
   - 返回登入頁面
   - 重新輸入 Email 地址
   - 點擊「Send Magic Link」按鈕

3. **檢查 Supabase 配置:**
   - 確認 Supabase Magic Link 有效期設定
   - 檢查 Supabase Dashboard 中的 Auth 設定

### 3. 認證失敗

**問題描述:**
- 點擊 Magic Link 後認證失敗
- 返回錯誤訊息

**可能原因:**
1. **跨環境問題:**
   - 從 Preview 發送 Magic Link，在 Production 打開
   - 從 Production 發送 Magic Link，在 Preview 打開

2. **認證碼過期:**
   - Magic Link 連結已過期
   - 認證碼已被使用

3. **Redirect URL 未配置:**
   - Supabase Redirect URLs 未正確配置
   - 回調 URL 不在允許列表中

**解決方法:**
1. **確認環境一致性:**
   - 確保在發送 Magic Link 的同一網域中打開連結
   - 檢查郵件中的連結 URL

2. **重新發送 Magic Link:**
   - 返回登入頁面
   - 重新發送 Magic Link

3. **檢查 Supabase 配置:**
   - 確認 Supabase Redirect URLs 配置正確
   - 檢查 Supabase Dashboard 中的 Auth 設定

### 4. Cookie 未設置

**問題描述:**
- 認證成功但 Cookie 未設置
- 無法訪問受保護路由

**解決方法:**
1. **檢查瀏覽器設定:**
   - 確認瀏覽器允許 Cookie
   - 檢查瀏覽器 Cookie 設定

2. **檢查 Cookie 設定:**
   - 確認 Supabase Cookie 設定正確
   - 檢查 Cookie 的 `domain`、`secure`、`sameSite` 屬性

3. **清除 Cookie 並重新登入:**
   - 清除瀏覽器 Cookie
   - 重新發送 Magic Link 並登入

## 📋 測試檢查清單

### 本地測試

- [ ] 環境變數配置正確（NEXT_PUBLIC_USE_MOCK=false）
- [ ] 本地服務器正常啟動
- [ ] 可以訪問登入頁面
- [ ] 可以成功發送 Magic Link
- [ ] 可以收到 Magic Link 郵件
- [ ] 可以成功點擊 Magic Link 並登入
- [ ] 可以訪問受保護路由（/orders, /settings, /results）
- [ ] 不會重定向到登入頁面

### Preview 測試

- [ ] Preview 部署正常
- [ ] 環境變數配置正確（NEXT_PUBLIC_USE_MOCK=true）
- [ ] 可以訪問 Preview 登入頁面
- [ ] 使用一次性測試信箱發送 Magic Link
- [ ] 可以收到 Magic Link 郵件
- [ ] 在 Preview 網域中打開 Magic Link（不跨環境）
- [ ] 可以成功登入
- [ ] 可以訪問受保護路由
- [ ] 不會重定向到登入頁面

### Production 測試

- [ ] Production 部署正常
- [ ] 環境變數配置正確（NEXT_PUBLIC_USE_MOCK=false）
- [ ] 可以訪問 Production 登入頁面
- [ ] 使用一次性測試信箱發送 Magic Link
- [ ] 可以收到 Magic Link 郵件
- [ ] 在 Production 網域中打開 Magic Link（不跨環境）
- [ ] 可以成功登入
- [ ] 可以訪問受保護路由
- [ ] 不會重定向到登入頁面

## 🔍 故障排除

### 問題: Magic Link 郵件未收到

**可能原因:**
1. 郵件被歸類為垃圾郵件
2. Supabase Email 發送配置問題
3. Email 地址錯誤

**解決方法:**
1. 檢查垃圾郵件資料夾
2. 檢查 Supabase Email 配置
3. 確認 Email 地址正確
4. 重新發送 Magic Link

### 問題: Magic Link 連結過期

**可能原因:**
1. 連結有效期已過（5-10 分鐘）
2. 連結已被使用

**解決方法:**
1. 重新發送 Magic Link
2. 檢查 Supabase Magic Link 有效期設定

### 問題: 認證失敗

**可能原因:**
1. 跨環境問題（最常見）
2. 認證碼過期
3. Redirect URL 未配置

**解決方法:**
1. 確認在發送 Magic Link 的同一網域中打開連結
2. 重新發送 Magic Link
3. 檢查 Supabase Redirect URLs 配置

### 問題: Cookie 未設置

**可能原因:**
1. 瀏覽器阻止 Cookie
2. Cookie 設定不正確
3. 跨域問題

**解決方法:**
1. 檢查瀏覽器 Cookie 設定
2. 確認 Supabase Cookie 設定正確
3. 清除 Cookie 並重新登入

## 📚 相關文檔

- [Cookie/Domain 與跨環境跳轉一致性說明](../deploy/auth-cookie-domain.md)
- [Supabase Auth 配置狀態](../deploy/supabase-auth-config-status.md)
- [Auth Redirect 測試說明](./auth-redirect.md)

## 🎯 最佳實踐總結

1. **環境一致性:**
   - 在發送 Magic Link 的同一環境中打開郵件
   - 避免跨環境操作

2. **測試信箱:**
   - 使用一次性測試信箱
   - 不同環境使用不同的測試信箱前綴

3. **異常處理:**
   - 檢查垃圾郵件資料夾
   - 確認連結未過期
   - 確認環境一致性

4. **驗證登入狀態:**
   - 確認可以訪問受保護路由
   - 確認不會重定向到登入頁面




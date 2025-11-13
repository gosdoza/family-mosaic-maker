# Supabase Auth 設定清單

本文档提供 Supabase Authentication 配置的完整检查清单，确保所有必要的认证设置都已正确配置。

## 📋 Auth 設定清單

### 1. 認證方式設定

#### Email 認證
- [x] **Enable Email** ✅ 已啟用
  - 位置: Supabase Dashboard → Authentication → Providers → Email
  - 狀態: 已啟用 Email 認證方式

#### Phone 認證
- [x] **Disable Phone** ✅ 已停用
  - 位置: Supabase Dashboard → Authentication → Providers → Phone
  - 狀態: 已停用 Phone 認證方式（僅使用 Email）

### 2. Magic Link / OTP 設定

#### 有效期設定
- [x] **OTP/Magic Link 有效期** ✅ 已設定
  - 位置: Supabase Dashboard → Authentication → URL Configuration → Magic Link Settings
  - 設定值: **5-10 分鐘**
  - 說明: Magic Link 和 OTP 代碼在 5-10 分鐘內有效

**建議設定:**
- Magic Link 有效期: `10 分鐘` (600 秒)
- OTP 有效期: `5 分鐘` (300 秒)

### 3. Redirect URLs 白名單

#### 已設定的 Redirect URLs
- [x] **Production 回調 URL** ✅ 已設定
  - URL: `https://family-mosaic-maker.vercel.app/auth/callback`
  - 用途: Production 環境的認證回調

- [x] **Preview 通配符回調 URL** ✅ 已設定
  - URL: `https://family-mosaic-maker-*.vercel.app/auth/callback`
  - 用途: Preview 部署的認證回調（通配符匹配所有預覽 URL）

**注意:** Redirect whitelist 只包含上述兩條正式 URL，確保安全性。

### 4. Site URL 設定

- [x] **Site URL** ✅ 已設定
  - URL: `https://family-mosaic-maker.vercel.app`
  - 位置: Supabase Dashboard → Authentication → URL Configuration → Site URL
  - 狀態: 已設置為 Production 域名

### 5. Email 發送設定

#### 當前配置狀態

**本次使用 Supabase 內建寄送** ✅

- [x] **使用 Supabase 預設 SMTP** ✅ 已啟用
  - 位置: Supabase Dashboard → Settings → Auth → SMTP Settings
  - 狀態: 使用 Supabase 內建的 Email 發送服務
  - 發送域名: `@supabase.co` (預設)

**說明:**
- 目前使用 Supabase 提供的預設 SMTP 服務
- 所有認證郵件（Magic Link、OTP 等）由 Supabase 發送
- 發送者地址格式: `noreply@<project-ref>.supabase.co`

#### 未來可切換自有域名寄件

**SMTP 自定義設定** (未來配置)

- [ ] **啟用自定義 SMTP** ⚠️ 待配置
  - 位置: Supabase Dashboard → Settings → Auth → SMTP Settings
  - 狀態: 未配置（未來可啟用）

**配置選項:**
- [ ] SMTP Host: `smtp.your-domain.com`
- [ ] SMTP Port: `587` (TLS) 或 `465` (SSL)
- [ ] SMTP User: `noreply@your-domain.com`
- [ ] SMTP Password: `your-smtp-password`
- [ ] 發送者名稱: `Family Mosaic Maker`
- [ ] 發送者地址: `noreply@your-domain.com`

**切換步驟:**
1. 在 Supabase Dashboard 進入 Settings → Auth → SMTP Settings
2. 啟用 "Enable Custom SMTP"
3. 填入上述 SMTP 配置資訊
4. 測試發送驗證郵件
5. 確認發送成功後啟用

**注意事項:**
- 確保 SMTP 服務支援 TLS/SSL
- 建議使用專用的發送域名（如 `noreply@your-domain.com`）
- 配置 SPF、DKIM、DMARC 記錄以提高郵件送達率
- 測試發送功能後再正式啟用

### 6. 其他認證設定

#### 密碼策略
- [x] **密碼最小長度** ✅ 已設定
  - 預設值: `8 個字符`
  - 位置: Supabase Dashboard → Authentication → Settings

#### 會話管理
- [x] **會話超時設定** ✅ 已設定
  - 預設值: `3600 秒` (1 小時)
  - 位置: Supabase Dashboard → Authentication → Settings

#### 安全設定
- [x] **啟用 HTTPS** ✅ 已啟用
  - 所有認證請求必須使用 HTTPS
  - 位置: Supabase Dashboard → Authentication → URL Configuration

## ✅ 配置完成狀態

**最後更新: 2025-11-09**

### 已完成項目
- ✅ Email 認證已啟用
- ✅ Phone 認證已停用
- ✅ Magic Link/OTP 有效期已設定 (5-10 分鐘)
- ✅ Redirect URLs 白名單已設定（兩條正式 URL）
- ✅ Site URL 已設定為 Production 域名
- ✅ 使用 Supabase 內建 SMTP 發送

### 待配置項目
- ⚠️ 自定義 SMTP（未來可選）

## 📋 驗證步驟

### 1. 檢查認證方式
1. 訪問 Supabase Dashboard → Authentication → Providers
2. 確認 Email 已啟用，Phone 已停用

### 2. 檢查 Magic Link 設定
1. 訪問 Supabase Dashboard → Authentication → URL Configuration
2. 確認 Magic Link 有效期設定為 5-10 分鐘

### 3. 檢查 Redirect URLs
1. 訪問 Supabase Dashboard → Authentication → URL Configuration
2. 確認 Redirect URLs 列表包含：
   - `https://family-mosaic-maker.vercel.app/auth/callback`
   - `https://family-mosaic-maker-*.vercel.app/auth/callback`

### 4. 檢查 SMTP 設定
1. 訪問 Supabase Dashboard → Settings → Auth → SMTP Settings
2. 確認當前使用 Supabase 預設 SMTP
3. （未來）如需切換，配置自定義 SMTP

## 🔍 測試驗證

### Magic Link 登入測試

1. **從 Preview 部署測試:**
   ```bash
   # 獲取 Preview URL
   PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)
   
   # 訪問登入頁面
   open "$PREVIEW_URL/auth/login"
   ```

2. **測試步驟:**
   - 輸入有效的 Email 地址
   - 點擊「發送 Magic Link」
   - 檢查郵件收件箱（包括垃圾郵件）
   - 點擊 Magic Link
   - 應重定向回站內（無跨網域錯誤）
   - 成功登入並顯示用戶信息

3. **預期結果:**
   - ✅ Magic Link 在 5-10 分鐘內有效
   - ✅ 重定向到正確的回調 URL
   - ✅ 無跨網域錯誤
   - ✅ 成功建立會話

## 📚 相關文檔

- [Supabase Auth URL Configuration](./supabase-auth-urls.md) - URL 配置詳細指南
- [Supabase Auth 配置狀態](./supabase-auth-config-status.md) - 當前配置狀態
- [Vercel Environment Variables Matrix](../VERCEL_ENV_MATRIX.md) - 環境變數配置

## 🔗 快速連結

**Supabase Dashboard:**
- [Auth Settings](https://supabase.com/dashboard/project/mxdexoahfmwbqwngzzsf/settings/auth)
- [Providers Settings](https://supabase.com/dashboard/project/mxdexoahfmwbqwngzzsf/auth/providers)
- [SMTP Settings](https://supabase.com/dashboard/project/mxdexoahfmwbqwngzzsf/settings/auth#smtp)

## ⚠️ 注意事項

1. **SMTP 配置:**
   - 當前使用 Supabase 內建 SMTP，無需額外配置
   - 未來如需切換自有域名，請參考上述 SMTP 自定義設定

2. **Redirect URLs 安全:**
   - 僅包含必要的回調 URL
   - 使用通配符匹配 Preview 部署
   - 定期檢查並清理不需要的 URL

3. **Magic Link 有效期:**
   - 建議設定為 5-10 分鐘，平衡安全性和用戶體驗
   - 過短可能導致用戶來不及點擊
   - 過長可能增加安全風險




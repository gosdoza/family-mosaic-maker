# Supabase Dashboard PKCE Email Link 设置 Checklist

本文档提供 Supabase Dashboard 中 PKCE Email Link 认证的完整设置清单。

## 📋 设置步骤

### 1. Site URL 设置

**位置**: Supabase Dashboard → Authentication → URL Configuration → Site URL

**设置值**:
```
https://family-mosaic-maker.vercel.app
```

**说明**: 这是 Production 环境的主域名，用于生成 Magic Link 的基础 URL。

---

### 2. Redirect URLs 白名单

**位置**: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

**需要添加的 URL**:

1. **Production 回调 URL**:
   ```
   https://family-mosaic-maker.vercel.app/auth/callback
   ```

2. **本地开发回调 URL**:
   ```
   http://localhost:3000/auth/callback
   ```

3. **Preview 部署通配符回调 URL** (可选，用于 Preview 环境):
   ```
   https://family-mosaic-maker-*.vercel.app/auth/callback
   ```

**重要提示**:
- ✅ 必须包含 `/auth/callback` 路径
- ✅ 必须使用完整的 URL（包含协议 `https://` 或 `http://`）
- ✅ Preview 通配符 URL 使用 `*` 匹配所有 Preview 部署
- ❌ 不要添加未使用的 URL，保持白名单最小化以提高安全性

---

### 3. Email 认证设置

**位置**: Supabase Dashboard → Authentication → Providers → Email

**设置项**:

- ✅ **Enable Email provider**: 已启用
- ✅ **Confirm email**: 根据需求设置（推荐：启用）
- ✅ **Secure email change**: 根据需求设置（推荐：启用）

---

### 4. Magic Link 设置

**位置**: Supabase Dashboard → Authentication → URL Configuration → Magic Link Settings

**设置项**:

- **Magic Link 有效期**: `10 分钟` (600 秒)
- **OTP 有效期**: `5 分钟` (300 秒)

**说明**: 
- Magic Link 有效期应该足够长，让用户有时间检查邮件
- 但也不应该太长，以保持安全性

---

### 5. PKCE 设置

**位置**: Supabase Dashboard → Authentication → URL Configuration

**设置项**:

- ✅ **PKCE (Proof Key for Code Exchange)**: 已启用（默认启用）

**说明**: 
- PKCE 是 Supabase 推荐的 OAuth 流程，提供更好的安全性
- 客户端会自动生成 `code_verifier` 并存储在 cookies 中
- 服务器端从 cookies 读取 `code_verifier` 并与 `code` 一起验证

---

## ✅ 验证清单

完成设置后，请验证以下项目：

- [ ] Site URL 设置为 `https://family-mosaic-maker.vercel.app`
- [ ] Redirect URLs 包含 `https://family-mosaic-maker.vercel.app/auth/callback`
- [ ] Redirect URLs 包含 `http://localhost:3000/auth/callback`
- [ ] Email provider 已启用
- [ ] Magic Link 有效期已设置（推荐：10 分钟）
- [ ] PKCE 已启用（默认启用）

---

## 🔍 测试步骤

### 本地测试

1. 启动开发服务器:
   ```bash
   pnpm dev
   ```

2. 访问登录页面:
   ```
   http://localhost:3000/auth/login
   ```

3. 输入邮箱并发送 Magic Link

4. 检查邮箱，点击 Magic Link

5. 验证是否成功重定向到 `/dashboard` 或 `/orders`

### Production 测试

1. 访问 Production 登录页面:
   ```
   https://family-mosaic-maker.vercel.app/auth/login
   ```

2. 输入邮箱并发送 Magic Link

3. 检查邮箱，点击 Magic Link

4. 验证是否成功重定向到 `/dashboard` 或 `/orders`

---

## ⚠️ 常见问题

### 问题 1: "invalid request: both auth code and code verifier should be non-empty"

**原因**: 
- Callback route 没有正确使用 `createServerClient` 从 cookies 读取 `code_verifier`
- 或者 cookies 没有正确设置

**解决方案**:
- 确保使用 `@supabase/ssr` 的 `createServerClient` 而不是 `@supabase/supabase-js` 的 `createClient`
- 确保 cookies 配置正确（参考 `app/auth/callback/route.ts`）

### 问题 2: "Invalid redirect URL"

**原因**: 
- Redirect URL 不在 Supabase Dashboard 的白名单中
- Redirect URL 格式不正确

**解决方案**:
- 检查 Supabase Dashboard 中的 Redirect URLs 设置
- 确保 URL 格式正确（包含协议和完整路径）

### 问题 3: Magic Link 过期

**原因**: 
- Magic Link 有效期设置太短
- 用户没有及时点击链接

**解决方案**:
- 增加 Magic Link 有效期（推荐：10 分钟）
- 提醒用户及时检查邮箱

---

## 📚 相关文档

- [Supabase Auth URL Configuration Guide](./deploy/supabase-auth-urls.md)
- [Supabase Auth 配置状态](./deploy/supabase-auth-config-status.md)
- [Magic Link E2E 测试说明](./tests/magic-link-e2e.md)

---

**最后更新**: 2025-11-13



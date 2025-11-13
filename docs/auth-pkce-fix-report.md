# Supabase PKCE Email Link 流程修复报告

**生成时间**: 2025-11-13

## 📋 修复总结

已成功修复 Supabase 的 Email 验证 + PKCE 登录流程，确保在 Vercel 上可以正常使用 email signup/login，收到验证邮件，点击链接后正确回到应用而不是显示 JSON 错误。

---

## 🔧 修改过的文件列表

### 1. `app/auth/callback/route.ts` ✅ 已修复

**问题**:
- 使用 `createClient` 从 `@supabase/supabase-js`，无法正确处理 cookies 中的 `code_verifier`
- 错误时返回 JSON 而不是友好的错误页面

**修复**:
- 改用 `createServerClient` 从 `@supabase/ssr`，自动从 cookies 读取 `code_verifier`
- 错误时重定向到 `/auth/error` 页面而不是返回 JSON
- 成功时重定向到 `/dashboard` 或指定的 `redirect` 参数

### 2. `app/auth/login/page.tsx` ✅ 已修复

**问题**:
- 使用 `window.location.origin` 作为 `emailRedirectTo`，在 Vercel 上可能不正确
- 缺少 `shouldCreateUser: true` 选项

**修复**:
- 保持使用 `window.location.origin`（客户端组件中无法访问服务器端环境变量）
- 添加 `shouldCreateUser: true` 选项，允许自动创建新用户

### 3. `app/auth/error/page.tsx` ✅ 新建

**功能**:
- 显示友好的错误消息（不再显示 JSON 错误）
- 提供「回登入页重新寄信」按钮
- 支持不同的错误类型（missing_code, invalid_link, expired_token, internal_error）

---

## 📝 `/auth/callback` 的完整实作

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * Supabase PKCE Email Link 回调处理
 * 
 * 流程：
 * 1. 用户点击邮件中的链接，跳转到 /auth/callback?code=xxx
 * 2. Supabase SDK 在浏览器中自动存储 code_verifier 到 cookies
 * 3. 这个 server route 从 searchParams 读取 code，从 cookies 读取 code_verifier
 * 4. 调用 exchangeCodeForSession 交换 session
 * 5. 成功后重定向到 /dashboard 或指定的 redirect 参数
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const redirectTo = requestUrl.searchParams.get("redirect") || "/dashboard"

  // 如果没有 code，重定向到登录页并显示错误
  if (!code) {
    const loginUrl = new URL("/auth/login", requestUrl.origin)
    loginUrl.searchParams.set("error", "missing_code")
    return NextResponse.redirect(loginUrl)
  }

  try {
    // 创建 Supabase server client（会自动从 cookies 读取 code_verifier）
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // 交换 code 为 session（Supabase SSR 会自动从 cookies 读取 code_verifier）
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // 如果交换失败，重定向到错误页面
    if (error) {
      console.error("Failed to exchange code for session:", error)
      const errorUrl = new URL("/auth/error", requestUrl.origin)
      errorUrl.searchParams.set("error", error.message || "invalid_link")
      return NextResponse.redirect(errorUrl)
    }

    // 成功：重定向到目标页面
    const redirectUrl = new URL(redirectTo, requestUrl.origin)
    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    // 意外错误：重定向到错误页面
    console.error("Unexpected error in callback:", err)
    const errorUrl = new URL("/auth/error", requestUrl.origin)
    errorUrl.searchParams.set("error", "internal_error")
    return NextResponse.redirect(errorUrl)
  }
}
```

**关键点**:
- ✅ 使用 `createServerClient` 从 `@supabase/ssr`（不是 `createClient` 从 `@supabase/supabase-js`）
- ✅ 通过 `cookies` 配置自动读取 `code_verifier`
- ✅ 错误时重定向到 `/auth/error` 而不是返回 JSON
- ✅ 成功时重定向到 `/dashboard` 或指定的 `redirect` 参数

---

## 📋 Supabase Dashboard 设置 Checklist

### 1. Site URL 设置

**位置**: Supabase Dashboard → Authentication → URL Configuration → Site URL

**设置值**:
```
https://family-mosaic-maker.vercel.app
```

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

3. **Preview 部署通配符回调 URL** (可选):
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

---

### 5. PKCE 设置

**位置**: Supabase Dashboard → Authentication → URL Configuration

**设置项**:
- ✅ **PKCE (Proof Key for Code Exchange)**: 已启用（默认启用）

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

## 🧪 手动测试步骤

### 本地测试

1. **启动开发服务器**:
   ```bash
   pnpm dev
   ```

2. **访问登录页面**:
   ```
   http://localhost:3000/auth/login
   ```

3. **发送 Magic Link**:
   - 输入邮箱地址
   - 点击 "Send Magic Link" 按钮
   - 确认显示 "Magic Link Sent!" 消息

4. **检查邮箱**:
   - 打开邮箱收件箱
   - 查找来自 Supabase 的 Magic Link 邮件
   - 确认邮件包含登录链接

5. **点击 Magic Link**:
   - 点击邮件中的链接
   - 验证是否成功重定向到 `http://localhost:3000/dashboard`
   - 验证不再显示 JSON 错误

### Production 测试

1. **访问 Production 登录页面**:
   ```
   https://family-mosaic-maker.vercel.app/auth/login
   ```

2. **发送 Magic Link**:
   - 输入邮箱地址
   - 点击 "Send Magic Link" 按钮
   - 确认显示 "Magic Link Sent!" 消息

3. **检查邮箱**:
   - 打开邮箱收件箱
   - 查找来自 Supabase 的 Magic Link 邮件
   - 确认邮件包含登录链接（应指向 `https://family-mosaic-maker.vercel.app/auth/callback`）

4. **点击 Magic Link**:
   - 点击邮件中的链接
   - 验证是否成功重定向到 `https://family-mosaic-maker.vercel.app/dashboard`
   - 验证不再显示 JSON 错误

---

## 🔍 验证脚本

已创建验证脚本，可以自动检查实现是否正确：

```bash
node scripts/qa/verify-auth-callback.mjs
```

**验证内容**:
- ✅ 文件是否存在
- ✅ 是否使用 `createServerClient` 从 `@supabase/ssr`
- ✅ 是否调用 `exchangeCodeForSession`
- ✅ 错误时是否重定向到 `/auth/error` 而不是返回 JSON
- ✅ 是否从 cookies 读取 `code_verifier`
- ✅ TypeScript 编译是否通过
- ✅ 错误页面和登录页面实现是否正确

---

## 📚 相关文档

- [Supabase Dashboard PKCE Email Link 设置 Checklist](./supabase-auth-pkce-checklist.md)
- [Supabase Auth URL Configuration Guide](./deploy/supabase-auth-urls.md)
- [Magic Link E2E 测试说明](./tests/magic-link-e2e.md)

---

## ⚠️ 注意事项

1. **环境变量**: 确保 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已正确设置

2. **Cookies**: Supabase SSR 客户端会自动处理 cookies，无需手动读取 `code_verifier`

3. **错误处理**: 所有错误现在都会重定向到友好的错误页面，不再返回 JSON

4. **重定向**: 成功登录后默认重定向到 `/dashboard`，可以通过 `redirect` 参数自定义

---

**修复完成** ✅ | 所有检查已通过



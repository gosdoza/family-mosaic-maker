# 测试认证绕过端点文档

**版本**: v2.0  
**最后更新**: 2025-11-12

## ⚠️ 安全警告

这些端点**仅用于 E2E 测试**，**不得在生产环境使用**。

## 📋 端点说明

### `POST /api/test/login`

用于在 E2E 测试中快速登录，使用密码认证而非 Magic Link，避免等待邮件或 toast 提示。

**请求体**:
```json
{
  "email": "qa1@example.com",
  "password": "QA_test_123!"
}
```

**响应**:
```json
{
  "ok": true,
  "user": {
    "id": "user-uuid",
    "email": "qa1@example.com"
  }
}
```

**功能**:
- 使用 `auth.signInWithPassword()` 尝试登录
- 如果用户不存在（"Invalid login credentials"），使用 Service Role 自动创建用户
- 创建用户后再次尝试登录
- 设置必要的 Supabase session cookies

**为何使用密码登录而非 Magic Link**:
- E2E 测试需要快速、可靠的登录流程
- Magic Link 需要等待邮件或模拟邮件服务，增加测试复杂度
- 密码登录可以立即完成，无需等待 toast 提示或邮件确认

### `POST /api/test/logout`

用于在 E2E 测试中快速登出。

**响应**:
```json
{
  "ok": true
}
```

**功能**:
- 调用 `auth.signOut()` 清除 session
- 清除所有 Supabase session cookies

## 🔒 安全机制

### 1. 环境检查

端点仅在以下条件**同时满足**时可用：

- `NODE_ENV !== "production"`
- `ALLOW_TEST_LOGIN === "true"`

如果任一条件不满足，端点将返回 `404 Not Found`（伪装为不存在）。

### 2. 生产环境保护

在生产环境（`NODE_ENV === "production"`）中，端点**完全禁用**，无论环境变量如何设置，始终返回 `404`。

### 3. 显式启用

必须显式设置 `ALLOW_TEST_LOGIN=true` 才能使用这些端点，防止意外启用。

### 4. 路由保护

`/api/test/*` 路由严禁在 production 部署，已通过环境守卫条件确保。

## 📝 使用方法

### 在 Playwright 测试中使用

```typescript
// beforeEach 中调用
beforeEach(async ({ page, request }) => {
  // 登录测试用户（使用密码）
  const loginResponse = await request.post("http://localhost:3000/api/test/login", {
    data: {
      email: "qa1@example.com",
      password: "QA_test_123!",
    },
  })
  
  if (loginResponse.ok()) {
    const loginData = await loginResponse.json()
    if (loginData.ok) {
      // 将 cookies 设置到 page context
      const setCookieHeaders = loginResponse.headers()["set-cookie"]
      if (setCookieHeaders) {
        const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
        const parsedCookies = cookieArray.map((cookieStr: string) => {
          // Parse cookie string...
        })
        await page.context().addCookies(parsedCookies)
      }
    }
  }
})

// afterEach 中登出
afterEach(async ({ request }) => {
  await request.post("http://localhost:3000/api/test/logout")
})
```

### 环境变量设置

在 `.env.local` 中必须包含：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ALLOW_TEST_LOGIN=true
```

**重要**: 
- 确保 `.env.local` 不会被提交到版本控制（已在 `.gitignore` 中）
- `SUPABASE_SERVICE_ROLE_KEY` 用于自动创建测试用户（如果用户不存在）

## 🚫 禁止事项

1. **不得在生产环境启用**
2. **不得在 CI/CD 中设置 `ALLOW_TEST_LOGIN=true`（除非是测试环境）**
3. **不得在真实用户数据上使用**
4. **不得绕过安全检查**

## 📚 相关文档

- [E2E 测试场景清单](./e2e-scenarios.md)
- [测试策略](./test-strategy.md)


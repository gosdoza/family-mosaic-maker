# Supabase Auth 配置状态

## ✅ 当前配置状态

**最后更新: 2025-11-09**

### Site URL
- ✅ **Production**: `https://family-mosaic-maker.vercel.app`

### Redirect URLs
- ✅ `https://family-mosaic-maker.vercel.app/auth/callback` (Production)
- ✅ `https://family-mosaic-maker-*.vercel.app/auth/callback` (Preview 通配符)
- ✅ `http://localhost:3000/auth/callback` (Development)

## 📋 配置步骤

### 1. 访问 Supabase Dashboard

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目
3. 进入 **Settings** → **Authentication** → **URL Configuration**

### 2. 设置 Site URL

在 **Site URL** 字段中设置：
```
https://family-mosaic-maker.vercel.app
```

### 3. 添加 Redirect URLs

在 **Redirect URLs** 列表中添加以下 URL：

1. **Production 回调:**
   ```
   https://family-mosaic-maker.vercel.app/auth/callback
   ```

2. **Preview 通配符回调:**
   ```
   https://family-mosaic-maker-*.vercel.app/auth/callback
   ```

3. **Development 回调:**
   ```
   http://localhost:3000/auth/callback
   ```

## ✅ 验证配置

### 测试 Magic Link 登录

1. **从 Preview 部署测试:**
   ```bash
   # 获取 Preview URL
   PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)
   
   # 访问登录页面
   open "$PREVIEW_URL/auth/login"
   ```

2. **预期行为:**
   - 输入邮箱，点击发送 Magic Link
   - 收到邮件，点击链接
   - 应重定向回站内（无跨网域错误）
   - 成功登录并显示用户信息

### 验收命令

```bash
# 从首页发起一次 Magic Link（Preview），完成登录后应回站内；无跨网域错误
```

## 🩺 Callback 健康檢查

### 測試場景

#### 1. 無效 Code 測試（非登入狀態）

**測試命令:**
```bash
# Production
curl -I "https://family-mosaic-maker.vercel.app/auth/callback?code=dummy"

# Preview
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)
curl -I "$PREVIEW_URL/auth/callback?code=dummy"

# Local
curl -I "http://localhost:3000/auth/callback?code=dummy"
```

**預期行為:**
- ✅ 返回 `HTTP/2 422` 或 `HTTP/2 400`（而非 200 / 302）
- ✅ 響應體包含錯誤信息（JSON 格式）
- ✅ 不會重定向到其他頁面

**預期輸出示例:**
```
HTTP/2 422
content-type: application/json

{"error":"Invalid or expired code"}
```

#### 2. 缺少 Code 參數測試

**測試命令:**
```bash
curl -I "https://family-mosaic-maker.vercel.app/auth/callback"
```

**預期行為:**
- ✅ 返回 `HTTP/2 400 Bad Request`
- ✅ 響應體: `Missing authorization code`
- ✅ 不會重定向

#### 3. 成功登入後重定向測試

**測試場景:**
1. 從 `/auth/login` 發起 Magic Link 登入
2. 點擊郵件中的 Magic Link（包含有效的 `code` 參數）
3. 完成認證後應重定向回站內

**預期行為:**
- ✅ 成功交換 session code
- ✅ 重定向到 `/orders`（預設）或 `redirect` 參數指定的頁面
- ✅ 返回 `HTTP/2 302` 或 `HTTP/2 307` 重定向
- ✅ `Location` header 指向目標頁面

**重定向參數支持:**
```bash
# 重定向到指定頁面
https://family-mosaic-maker.vercel.app/auth/callback?code=valid-code&redirect=/settings

# 預設重定向到 /orders
https://family-mosaic-maker.vercel.app/auth/callback?code=valid-code
```

### 健康檢查驗收命令

```bash
# 1. 測試無效 code（應返回 4xx）
curl -I "https://family-mosaic-maker.vercel.app/auth/callback?code=dummy"
# 預期：HTTP/2 4xx（而非 200 / 302）

# 2. 測試缺少 code（應返回 400）
curl -I "https://family-mosaic-maker.vercel.app/auth/callback"
# 預期：HTTP/2 400

# 3. 測試成功登入（需要有效的 code）
# 從實際的 Magic Link 測試，應重定向到 /orders
```

### 預期響應狀態碼

| 場景 | 狀態碼 | 說明 |
|------|--------|------|
| 缺少 `code` 參數 | `400` | Bad Request |
| 無效/過期的 `code` | `422` | Unprocessable Entity |
| 有效的 `code` | `302`/`307` | 重定向到 `/orders` 或 `redirect` 參數 |
| 服務器錯誤 | `500` | Internal Server Error |

### 驗證步驟

1. **測試無效 Code:**
   ```bash
   curl -I "https://family-mosaic-maker.vercel.app/auth/callback?code=dummy"
   ```
   - ✅ 應返回 `HTTP/2 422` 或 `HTTP/2 400`
   - ✅ 不應返回 `200` 或 `302`

2. **測試缺少 Code:**
   ```bash
   curl -I "https://family-mosaic-maker.vercel.app/auth/callback"
   ```
   - ✅ 應返回 `HTTP/2 400`
   - ✅ 響應體: `Missing authorization code`

3. **測試成功登入（需要實際的 Magic Link）:**
   - 從 `/auth/login` 發起 Magic Link
   - 點擊郵件中的連結
   - ✅ 應重定向到 `/orders` 或指定的 `redirect` 參數
   - ✅ 無跨網域錯誤

## 🔍 故障排除

### 跨网域错误

如果出现跨网域错误：
1. 检查 Redirect URLs 是否包含正确的 URL
2. 确保 Preview URL 匹配通配符模式 `https://family-mosaic-maker-*.vercel.app/auth/callback`
3. 验证 Site URL 设置为 `https://family-mosaic-maker.vercel.app`

### 重定向失败

如果重定向失败：
1. 检查回调 URL 是否在 Redirect URLs 列表中
2. 确保 URL 格式正确（无多余斜杠）
3. 验证环境变量 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已设置

## 📚 相关文档

- [Supabase Auth URL Configuration](./supabase-auth-urls.md)
- [Vercel Environment Variables Matrix](../VERCEL_ENV_MATRIX.md)


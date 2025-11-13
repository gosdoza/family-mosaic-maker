# Implementation Summary - 3 个最小工作包

## ✅ A) i18n 最小可用版

### 已完成

1. **创建 `/lib/i18n.ts`**
   - `getLocale()`: 优先读取 cookie "lang"，然后 `navigator.language`，最后默认 "en"
   - `setLocale()`: 设置 "lang" cookie 并重新加载页面

2. **创建 locale 文件**
   - `/locales/en.json`: 英文翻译（20-30 个常用键）
   - `/locales/zh.json`: 中文翻译
   - `/locales/ja.json`: 日文翻译

3. **创建 `/lib/i18n-client.ts`**
   - `t(key)`: 从当前 locale 映射中获取翻译的工具函数

4. **在 `/app/settings/page.tsx` 添加 LanguageSwitcher**
   - 设置 "lang" cookie 并重新加载页面
   - 支持 EN / 中文 / 日本語 切换

5. **在组件中集成 i18n**
   - `components/navigation.tsx`: 导航链接使用 `t()`
   - `components/footer.tsx`: Footer 链接使用 `t()`
   - `app/(public)/page.tsx`: Hero 和 CTA 使用 `t()`
   - `app/pricing/page.tsx`: 定价页面使用 `t()`

### 验证

```bash
# 本地测试
pnpm dev
# 访问 http://localhost:3000/settings
# 切换语言，验证导航、Footer、Hero、定价页面是否更新
```

---

## ✅ B) QA tokens 与动画节奏

### 已完成

1. **创建 `/styles/theme.css`**
   - 导出 CSS 变量（colors, radius, spacing, durations）
   - 动画持续时间：`--duration-fast: 200ms`, `--duration-normal: 300ms`, `--duration-slow: 500ms`
   - 间距 tokens: `--spacing-xs` 到 `--spacing-2xl`
   - 圆角 tokens: `--radius-xs` 到 `--radius-full`
   - 过渡时间函数: `--ease-in-out`, `--ease-out`, `--ease-in`

2. **在 `/app/layout.tsx` 导入 theme.css**
   - 确保全局样式变量可用

3. **动画节奏规则**
   - 交互式元素（button, a, input）使用 `--duration-fast: 200ms`
   - 其他元素使用 `--duration-normal: 300ms`
   - 所有动画持续时间 ≤ 300ms（符合交互式 UI 最佳实践）

### 验证

```bash
# 检查 CSS 变量是否生效
# 在浏览器 DevTools 中检查 :root 变量
# 验证按钮 hover 动画是否使用 200ms
```

---

## 📋 C) Supabase Auth 实测（非 mock）

### 配置步骤

#### 1. 设置 Production 环境变量

在 Vercel Dashboard 中设置 Production 环境变量：

```bash
# Production 环境
NEXT_PUBLIC_USE_MOCK=false
```

**注意：** Preview 环境可以保留 `NEXT_PUBLIC_USE_MOCK=true` 用于测试。

#### 2. 确认 Supabase Auth Redirect URLs

在 Supabase Dashboard → Authentication → URL Configuration 中配置：

**Production URLs:**
- ✅ `https://family-mosaic-maker.vercel.app/auth/callback`
- ✅ `https://family-mosaic-maker.vercel.app/*`

**Preview URLs (保持):**
- ✅ `https://family-mosaic-maker-*.vercel.app/auth/callback`
- ✅ `https://family-mosaic-maker-*.vercel.app/*`

**Development URLs:**
- ✅ `http://localhost:3000/auth/callback`
- ✅ `http://localhost:3000/*`

#### 3. 测试 Auth Redirect

**本地测试（mock=false）:**
```bash
# 设置环境变量
export NEXT_PUBLIC_USE_MOCK=false

# 启动开发服务器
pnpm dev

# 测试未登录访问 /orders
curl -I http://localhost:3000/orders
# 预期: HTTP/1.1 307 → /auth/login?redirect=/orders
```

**生产环境测试:**
```bash
# 测试未登录访问 /orders
curl -I https://family-mosaic-maker.vercel.app/orders
# 预期: HTTP/2 307 → /auth/login?redirect=/orders
```

#### 4. 完整流程测试

1. **访问 `/orders`（未登录）**
   - 应重定向到 `/auth/login?redirect=/orders`

2. **完成 magic link 登录**
   - 点击登录链接
   - 完成 Supabase 认证流程
   - 应重定向回 `/orders`

3. **验证 `/orders` 加载**
   - 如果数据库为空，使用 mock 数据
   - 如果数据库有数据，显示真实订单

### 验证命令

```bash
# Mock 烟雾测试
pnpm test:smoke

# Full flow（mock）
pnpm test:e2e

# Health check
curl -i https://family-mosaic-maker.vercel.app/api/health

# Auth Redirect（非 mock）
# 设置 NEXT_PUBLIC_USE_MOCK=false 后
curl -I https://family-mosaic-maker.vercel.app/orders
# 预期: HTTP/2 307 → /auth/login?redirect=/orders
```

---

## 📝 验收指令

### 本地验证

```bash
# 1. i18n 测试
pnpm dev
# 访问 http://localhost:3000/settings
# 切换语言，验证所有文本是否更新

# 2. Theme tokens 测试
# 在浏览器 DevTools 中检查 CSS 变量
# 验证动画持续时间是否符合规范

# 3. Auth Redirect 测试（mock=false）
export NEXT_PUBLIC_USE_MOCK=false
pnpm dev
curl -I http://localhost:3000/orders
# 预期: 307 → /auth/login?redirect=/orders
```

### CI/生产验证

```bash
# Mock 烟雾测试
pnpm test:smoke

# Full flow（mock）
pnpm test:e2e

# Health check
curl -i https://family-mosaic-maker.vercel.app/api/health

# Auth Redirect（非 mock）
curl -I https://family-mosaic-maker.vercel.app/orders
# 预期: HTTP/2 307 → /auth/login?redirect=/orders
```

---

## 🎯 完成状态

- ✅ A) i18n 最小可用版
- ✅ B) QA tokens 与动画节奏
- 📋 C) Supabase Auth 实测（需要手动配置 Vercel 环境变量和 Supabase Dashboard）

---

## 📚 相关文档

- [Supabase Auth URL Configuration](./deploy/supabase-auth-urls.md)
- [Vercel Environment Variables Guide](./deploy/env-checklist.md)




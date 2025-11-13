# Auth Redirect 測試說明

本文档描述 Middleware 保護規則的期望行為，包括 Production 和 Preview 環境的不同處理方式。

## 📋 受保護路由

以下路由需要登入才能訪問：

1. **`/orders`** - 訂單列表頁面
2. **`/results`** - 結果列表頁面
3. **`/settings`** - 設定頁面

## 🔒 保護規則

### Production 環境 (NEXT_PUBLIC_USE_MOCK=false)

**期望行為:**
- ✅ 未登入訪問受保護路由應返回 `HTTP/2 307 Temporary Redirect`
- ✅ 重定向到 `/auth/login?redirect=<path>`
- ✅ `Location` header 包含原始路徑作為 `redirect` 參數

**測試場景:**
```bash
# 測試 /orders
curl -I https://family-mosaic-maker.vercel.app/orders
# 預期：HTTP/2 307
# 預期：Location: /auth/login?redirect=/orders

# 測試 /results
curl -I https://family-mosaic-maker.vercel.app/results
# 預期：HTTP/2 307
# 預期：Location: /auth/login?redirect=/results

# 測試 /settings
curl -I https://family-mosaic-maker.vercel.app/settings
# 預期：HTTP/2 307
# 預期：Location: /auth/login?redirect=/settings
```

### Preview 環境 (NEXT_PUBLIC_USE_MOCK=true)

**期望行為:**
- ✅ 未登入訪問受保護路由應返回 `HTTP/2 200 OK`
- ✅ 允許瀏覽（因為 mock 模式）
- ✅ 不需要重定向到登入頁面

**測試場景:**
```bash
# 獲取 Preview URL
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)

# 測試 /orders
curl -I "$PREVIEW_URL/orders"
# 預期：HTTP/2 200（因 mock=true）

# 測試 /results
curl -I "$PREVIEW_URL/results"
# 預期：HTTP/2 200（因 mock=true）

# 測試 /settings
curl -I "$PREVIEW_URL/settings"
# 預期：HTTP/2 200（因 mock=true）
```

## 📋 測試場景

### 場景 1: Production 未登入訪問受保護路由

**測試命令:**
```bash
# 測試 /orders
curl -I https://family-mosaic-maker.vercel.app/orders

# 測試 /results
curl -I https://family-mosaic-maker.vercel.app/results

# 測試 /settings
curl -I https://family-mosaic-maker.vercel.app/settings
```

**預期結果:**
- ✅ 狀態碼: `HTTP/2 307 Temporary Redirect`
- ✅ `Location` header: `/auth/login?redirect=/orders` (或對應的路徑)
- ✅ 不應返回 `200` 或 `404`

**預期輸出示例:**
```
HTTP/2 307
location: /auth/login?redirect=/orders
...
```

### 場景 2: Preview 未登入訪問受保護路由

**測試命令:**
```bash
# 獲取 Preview URL
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)

# 測試 /orders
curl -I "$PREVIEW_URL/orders"
```

**預期結果:**
- ✅ 狀態碼: `HTTP/2 200 OK`
- ✅ 允許瀏覽（因為 `NEXT_PUBLIC_USE_MOCK=true`）
- ✅ 不應重定向

**預期輸出示例:**
```
HTTP/2 200
...
```

### 場景 3: 已登入訪問受保護路由

**測試場景:**
1. 完成 Magic Link 登入
2. 訪問受保護路由

**預期結果:**
- ✅ 狀態碼: `HTTP/2 200 OK`
- ✅ 正常顯示頁面內容
- ✅ 不應重定向到登入頁面

## ✅ 驗收命令

### Production 環境（未登入）

```bash
# 測試 /orders
curl -I https://family-mosaic-maker.vercel.app/orders
# 預期：HTTP/2 307 並含 Location: /auth/login?redirect=/orders

# 測試 /results
curl -I https://family-mosaic-maker.vercel.app/results
# 預期：HTTP/2 307 並含 Location: /auth/login?redirect=/results

# 測試 /settings
curl -I https://family-mosaic-maker.vercel.app/settings
# 預期：HTTP/2 307 並含 Location: /auth/login?redirect=/settings
```

### Preview 環境（未登入）

```bash
# 獲取 Preview URL
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)

# 測試 /orders
curl -I "$PREVIEW_URL/orders"
# 預期：HTTP/2 200（因 mock=true）

# 測試 /results
curl -I "$PREVIEW_URL/results"
# 預期：HTTP/2 200（因 mock=true）

# 測試 /settings
curl -I "$PREVIEW_URL/settings"
# 預期：HTTP/2 200（因 mock=true）
```

## 📊 預期響應狀態碼

| 環境 | 路由 | 未登入狀態 | 已登入狀態 |
|------|------|-----------|-----------|
| Production | `/orders` | `307` → `/auth/login?redirect=/orders` | `200` |
| Production | `/results` | `307` → `/auth/login?redirect=/results` | `200` |
| Production | `/settings` | `307` → `/auth/login?redirect=/settings` | `200` |
| Preview | `/orders` | `200` (mock=true) | `200` |
| Preview | `/results` | `200` (mock=true) | `200` |
| Preview | `/settings` | `200` (mock=true) | `200` |

## 🔍 驗證步驟

### 1. 驗證 Production 保護規則

```bash
# 測試所有受保護路由
for path in /orders /results /settings; do
  echo "測試: $path"
  curl -I "https://family-mosaic-maker.vercel.app$path" 2>&1 | grep -E "HTTP|location"
  echo ""
done
```

**預期輸出:**
- 所有路由都返回 `HTTP/2 307`
- `location` header 包含 `/auth/login?redirect=<path>`

### 2. 驗證 Preview 允許瀏覽

```bash
# 獲取 Preview URL
PREVIEW_URL=$(vercel ls | grep -oE 'https://[a-zA-Z0-9\-\.]+\.vercel\.app' | grep -v 'family-mosaic-maker\.vercel\.app' | head -1)

# 測試所有受保護路由
for path in /orders /results /settings; do
  echo "測試: $path"
  curl -I "$PREVIEW_URL$path" 2>&1 | grep -E "HTTP"
  echo ""
done
```

**預期輸出:**
- 所有路由都返回 `HTTP/2 200`
- 不應有 `location` header

### 3. 驗證重定向參數

```bash
# 測試重定向參數是否正確
curl -I "https://family-mosaic-maker.vercel.app/orders" 2>&1 | grep -i location
# 預期：location: /auth/login?redirect=/orders
```

## 📝 測試檢查清單

- [ ] Production `/orders` 未登入 → `307` → `/auth/login?redirect=/orders`
- [ ] Production `/results` 未登入 → `307` → `/auth/login?redirect=/results`
- [ ] Production `/settings` 未登入 → `307` → `/auth/login?redirect=/settings`
- [ ] Preview `/orders` 未登入 → `200` (mock=true)
- [ ] Preview `/results` 未登入 → `200` (mock=true)
- [ ] Preview `/settings` 未登入 → `200` (mock=true)
- [ ] 已登入訪問所有受保護路由 → `200`

## 🔧 故障排除

### Production 返回 200 而非 307

**可能原因:**
1. `NEXT_PUBLIC_USE_MOCK` 環境變數未正確設置為 `false`
2. Middleware 未正確處理受保護路由
3. 認證檢查邏輯有問題

**解決方法:**
1. 檢查 Vercel Production 環境變數: `vercel env ls production | grep USE_MOCK`
2. 確認 Middleware 正確處理受保護路由
3. 檢查認證邏輯是否正確

### Preview 返回 307 而非 200

**可能原因:**
1. `NEXT_PUBLIC_USE_MOCK` 環境變數未正確設置為 `true`
2. Middleware 未正確檢查 mock 模式

**解決方法:**
1. 檢查 Vercel Preview 環境變數: `vercel env ls preview | grep USE_MOCK`
2. 確認 Middleware 正確檢查 `NEXT_PUBLIC_USE_MOCK` 環境變數

### 重定向 URL 不正確

**可能原因:**
1. Middleware 未正確構建重定向 URL
2. `redirect` 參數未正確編碼

**解決方法:**
1. 檢查 Middleware 中的重定向邏輯
2. 確認 URL 編碼正確

## 📚 相關文檔

- [Supabase Auth 配置狀態](../deploy/supabase-auth-config-status.md)
- [Vercel Environment Variables Matrix](../VERCEL_ENV_MATRIX.md)
- [Middleware 配置](../../middleware.ts)




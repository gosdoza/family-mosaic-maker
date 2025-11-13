# RLS 基準策略

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档定义 Row Level Security (RLS) 基准策略，包括规则定义、角色权限和测试矩阵。

## 📋 目錄

- [RLS 規則定義](#rls-規則定義)
- [角色定義](#角色定義)
- [策略實現](#策略實現)
- [測試矩陣](#測試矩陣)
- [測試用例](#測試用例)

## 🔒 RLS 規則定義

### 核心原則

1. **僅本人可讀寫**: 用戶只能訪問自己的數據（使用 `auth.uid() = user_id`）
2. **禁止 DELETE**: 所有表禁止物理刪除，使用軟刪除（`deleted_at` 字段）
3. **最小權限**: 僅授予必要的權限，默認拒絕所有訪問

### 規則列表

#### 1. `images` 表規則

| 操作 | 規則 | 說明 |
|------|------|------|
| SELECT | `auth.uid() = user_id` | 僅本人可查看自己的圖片 |
| INSERT | `auth.uid() = user_id` | 僅本人可插入自己的圖片 |
| UPDATE | `auth.uid() = user_id` | 僅本人可更新自己的圖片 |
| DELETE | ❌ **禁止** | 禁止物理刪除，使用軟刪除 |

#### 2. `assets` 表規則

| 操作 | 規則 | 說明 |
|------|------|------|
| SELECT | `auth.uid() = user_id` | 僅本人可查看自己的資源 |
| INSERT | `auth.uid() = user_id` | 僅本人可插入自己的資源 |
| UPDATE | `auth.uid() = user_id` | 僅本人可更新自己的資源 |
| DELETE | ❌ **禁止** | 禁止物理刪除，使用軟刪除 |

#### 3. `orders` 表規則

| 操作 | 規則 | 說明 |
|------|------|------|
| SELECT | `auth.uid() = user_id` | 僅本人可查看自己的訂單 |
| INSERT | `auth.uid() = user_id` | 僅本人可插入自己的訂單 |
| UPDATE | `auth.uid() = user_id` | 僅本人可更新自己的訂單 |
| DELETE | ❌ **禁止** | 禁止物理刪除 |

## 👥 角色定義

### 最小角色

#### 1. `user` - 普通用戶

**權限**:
- ✅ 可以查看、插入、更新自己的數據
- ❌ 不能查看其他用戶的數據
- ❌ 不能刪除數據（物理刪除）
- ❌ 不能訪問管理功能

**適用表**: `images`, `assets`, `orders`

#### 2. `admin` - 管理員

**權限**:
- ✅ 可以查看、插入、更新所有數據
- ✅ 可以查看其他用戶的數據（用於支持）
- ❌ 不能刪除數據（物理刪除）
- ✅ 可以訪問管理功能（未來擴展）

**適用表**: `images`, `assets`, `orders`

**實現方式**: 使用 Service Role Key（繞過 RLS）或特殊 RLS 策略

### 角色識別

**用戶角色識別**:
- 普通用戶: `auth.uid()` 存在且不在管理員列表中
- 管理員: `auth.uid()` 存在且在管理員列表中（或使用 Service Role）

**匿名用戶**:
- `auth.uid()` 為 `NULL`
- 所有操作應返回 `401 Unauthorized` 或 `403 Forbidden`

## 📝 策略實現

### `images` 表策略

```sql
-- 啟用 RLS
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- SELECT 策略：僅本人可查看
CREATE POLICY "Users can view their own images"
  ON public.images FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 策略：僅本人可插入
CREATE POLICY "Users can insert their own images"
  ON public.images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE 策略：僅本人可更新
CREATE POLICY "Users can update their own images"
  ON public.images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 策略：禁止物理刪除
-- 不創建 DELETE 策略，默認拒絕所有 DELETE 操作
```

### `assets` 表策略

```sql
-- 啟用 RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- SELECT 策略：僅本人可查看
CREATE POLICY "Users can view their own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 策略：僅本人可插入
CREATE POLICY "Users can insert their own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE 策略：僅本人可更新
CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 策略：禁止物理刪除
-- 不創建 DELETE 策略，默認拒絕所有 DELETE 操作
```

### `orders` 表策略

```sql
-- 啟用 RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- SELECT 策略：僅本人可查看
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT 策略：僅本人可插入
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE 策略：僅本人可更新
CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE 策略：禁止物理刪除
-- 不創建 DELETE 策略，默認拒絕所有 DELETE 操作
```

## 📊 測試矩陣

### RLS 測試矩陣表

| 表 | 操作 | 匿名用戶 | 非本人用戶 | 本人用戶 | 管理員 |
|----|------|---------|-----------|---------|--------|
| `images` | SELECT | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `images` | INSERT | ❌ 401/403 | ❌ 401/403 | ✅ 201 | ✅ 201 |
| `images` | UPDATE | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `images` | DELETE | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 |
| `assets` | SELECT | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `assets` | INSERT | ❌ 401/403 | ❌ 401/403 | ✅ 201 | ✅ 201 |
| `assets` | UPDATE | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `assets` | DELETE | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 |
| `orders` | SELECT | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `orders` | INSERT | ❌ 401/403 | ❌ 401/403 | ✅ 201 | ✅ 201 |
| `orders` | UPDATE | ❌ 401/403 | ❌ 401/403 | ✅ 200 | ✅ 200 |
| `orders` | DELETE | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 | ❌ 401/403 |

**圖例**:
- ✅ 200/201: 成功（允許操作）
- ❌ 401/403: 失敗（拒絕操作）

### 失敗用例（期待 401/403）

#### 1. 匿名用戶訪問

**場景**: 未登入用戶嘗試訪問數據

**預期結果**: `401 Unauthorized` 或 `403 Forbidden`

**測試用例**:
- 匿名用戶查看自己的圖片 → ❌ 401/403
- 匿名用戶插入圖片 → ❌ 401/403
- 匿名用戶更新圖片 → ❌ 401/403
- 匿名用戶刪除圖片 → ❌ 401/403

#### 2. 非本人用戶訪問

**場景**: 用戶 A 嘗試訪問用戶 B 的數據

**預期結果**: `401 Unauthorized` 或 `403 Forbidden`

**測試用例**:
- 用戶 A 查看用戶 B 的圖片 → ❌ 401/403
- 用戶 A 插入用戶 B 的圖片（user_id=B） → ❌ 401/403
- 用戶 A 更新用戶 B 的圖片 → ❌ 401/403
- 用戶 A 刪除用戶 B 的圖片 → ❌ 401/403

#### 3. DELETE 操作

**場景**: 任何用戶嘗試物理刪除數據

**預期結果**: `401 Unauthorized` 或 `403 Forbidden`

**測試用例**:
- 本人用戶刪除自己的圖片 → ❌ 401/403
- 管理員刪除圖片 → ❌ 401/403
- 匿名用戶刪除圖片 → ❌ 401/403

## 🧪 測試用例

### 測試環境設置

```bash
# 設置測試環境變數
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 測試用例 1: 匿名用戶訪問

#### 1.1 匿名用戶查看圖片

```bash
# 測試命令
curl -i "${SUPABASE_URL}/rest/v1/images?id=eq.demo-001" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應:
# HTTP/2 401
# {"message":"JWT expired" or "new row violates row-level security policy"}
```

#### 1.2 匿名用戶插入圖片

```bash
# 測試命令
curl -i -X POST "${SUPABASE_URL}/rest/v1/images" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","job_id":"demo-001","file_path":"test.jpg"}'

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
```

#### 1.3 匿名用戶更新圖片

```bash
# 測試命令
curl -i -X PATCH "${SUPABASE_URL}/rest/v1/images?id=eq.demo-001" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"file_path":"updated.jpg"}'

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
```

#### 1.4 匿名用戶刪除圖片

```bash
# 測試命令
curl -i -X DELETE "${SUPABASE_URL}/rest/v1/images?id=eq.demo-001" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
```

### 測試用例 2: 非本人用戶訪問

#### 2.1 用戶 A 查看用戶 B 的圖片

```bash
# 獲取用戶 A 的 JWT Token（登入後）
export USER_A_TOKEN="<user-a-jwt-token>"

# 測試命令（嘗試訪問用戶 B 的圖片）
curl -i "${SUPABASE_URL}/rest/v1/images?id=eq.<user-b-image-id>" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應: 空結果集或錯誤訊息
```

#### 2.2 用戶 A 插入用戶 B 的圖片

```bash
# 測試命令（嘗試插入 user_id 為用戶 B 的圖片）
curl -i -X POST "${SUPABASE_URL}/rest/v1/images" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<user-b-id>","job_id":"demo-001","file_path":"test.jpg"}'

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應: "new row violates row-level security policy"
```

#### 2.3 用戶 A 更新用戶 B 的圖片

```bash
# 測試命令（嘗試更新用戶 B 的圖片）
curl -i -X PATCH "${SUPABASE_URL}/rest/v1/images?id=eq.<user-b-image-id>" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"file_path":"updated.jpg"}'

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應: 空結果集或錯誤訊息
```

### 測試用例 3: 本人用戶訪問

#### 3.1 本人用戶查看自己的圖片

```bash
# 獲取用戶 A 的 JWT Token
export USER_A_TOKEN="<user-a-jwt-token>"

# 測試命令（查看自己的圖片）
curl -i "${SUPABASE_URL}/rest/v1/images?user_id=eq.<user-a-id>" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}"

# 預期結果: HTTP/2 200 OK
# 預期響應: 包含用戶 A 的圖片列表
```

#### 3.2 本人用戶插入自己的圖片

```bash
# 測試命令（插入自己的圖片）
curl -i -X POST "${SUPABASE_URL}/rest/v1/images" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<user-a-id>","job_id":"demo-001","file_path":"test.jpg","original_filename":"test.jpg","file_size":1024,"mime_type":"image/jpeg","expires_at":"2025-11-12T00:00:00Z"}'

# 預期結果: HTTP/2 201 Created
# 預期響應: 包含新創建的圖片記錄
```

#### 3.3 本人用戶更新自己的圖片

```bash
# 測試命令（更新自己的圖片）
curl -i -X PATCH "${SUPABASE_URL}/rest/v1/images?id=eq.<user-a-image-id>" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"file_path":"updated.jpg"}'

# 預期結果: HTTP/2 200 OK
# 預期響應: 包含更新後的圖片記錄
```

#### 3.4 本人用戶嘗試刪除自己的圖片

```bash
# 測試命令（嘗試刪除自己的圖片）
curl -i -X DELETE "${SUPABASE_URL}/rest/v1/images?id=eq.<user-a-image-id>" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${USER_A_TOKEN}"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應: 錯誤訊息（DELETE 操作被禁止）
```

### 測試用例 4: API 端點測試

#### 4.1 匿名用戶訪問 `/api/results`

```bash
# 測試命令
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results?id=demo-001"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應:
# HTTP/2 401
# {"error":"Unauthorized" or "Forbidden"}
```

#### 4.2 非本人用戶訪問 `/api/results`

```bash
# 獲取用戶 A 的 Session Cookie（登入後）
# 測試命令（嘗試訪問用戶 B 的結果）
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results?id=<user-b-job-id>" \
  -H "Cookie: <user-a-session-cookie>"

# 預期結果: HTTP/2 401 Unauthorized 或 403 Forbidden
# 預期響應: 空結果集或錯誤訊息
```

#### 4.3 本人用戶訪問 `/api/results`

```bash
# 獲取用戶 A 的 Session Cookie（登入後）
# 測試命令（查看自己的結果）
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results?id=<user-a-job-id>" \
  -H "Cookie: <user-a-session-cookie>"

# 預期結果: HTTP/2 200 OK
# 預期響應: 包含用戶 A 的結果數據
```

## 🔍 驗證步驟

### 1. 驗證 RLS 已啟用

```sql
-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders');

-- 預期結果: rowsecurity = true
```

### 2. 驗證策略已創建

```sql
-- 檢查策略是否存在
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('images', 'assets', 'orders')
ORDER BY tablename, policyname;

-- 預期結果: 每個表應有 SELECT, INSERT, UPDATE 策略（無 DELETE 策略）
```

### 3. 驗證策略規則

```sql
-- 檢查策略規則（以 images 表為例）
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'images';

-- 預期結果:
-- SELECT: qual = "auth.uid() = user_id"
-- INSERT: with_check = "auth.uid() = user_id"
-- UPDATE: qual = "auth.uid() = user_id" AND with_check = "auth.uid() = user_id"
```

## 📚 相關文檔

- [最小資料庫架構](./min-schema.md)
- [Supabase RLS 文檔](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth 配置狀態](../deploy/supabase-auth-config-status.md)

## 🔧 工具和命令

### 測試腳本

```bash
#!/bin/bash
# RLS 測試腳本

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"

echo "🔍 RLS 測試 - 匿名用戶訪問"
echo ""

# 測試 1: 匿名用戶查看圖片
echo "測試 1: 匿名用戶查看圖片"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/images?id=eq.demo-001" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
  echo "✅ 預期結果: HTTP $RESPONSE (拒絕訪問)"
else
  echo "❌ 意外結果: HTTP $RESPONSE (應為 401 或 403)"
fi

echo ""
echo "測試完成"
```

### 驗證命令

```bash
# 驗收命令：匿名用戶訪問 API
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results?id=demo-001"

# 預期：HTTP/2 401 Unauthorized 或 403 Forbidden
```

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 RLS 基準策略和測試矩陣




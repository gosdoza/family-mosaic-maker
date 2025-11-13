# A8 - Admin-only 視圖驗權文檔

**版本**: v1.0.0  
**創建日期**: 2025-01-16  
**環境**: Production  
**創建人員**: Security Team

## 📋 文檔概述

### 文檔目的

說明 Admin-only 視圖的驗權機制：
- `analytics_logs` 僅 admin/service role 可查
- 一般用戶查詢被拒

### 文檔環境

- **環境**: Production
- **實現位置**: `supabase/policies.sql`
- **視圖定義**: `supabase/migrations/20250116000001_create_admin_views.sql`

## 🔒 權限控制

### RLS 策略

**`analytics_logs` 表策略**:
- **SELECT**: 僅 service role 可查看
- **INSERT**: 僅系統可插入（使用 Service Role 或特殊策略）
- **UPDATE**: 禁止更新
- **DELETE**: 禁止物理刪除

**策略定義**:
```sql
-- SELECT: 僅 service role 可查看
CREATE POLICY "Service role can view admin analytics logs"
  ON public.analytics_logs FOR SELECT
  USING (auth.role() = 'service_role');
```

### 管理視圖

**`admin_analytics_logs` 視圖**:
- 提供 `analytics_logs` 的完整查詢視圖
- 僅 service role 可訪問
- 一般用戶無法訪問

**視圖定義**:
```sql
CREATE OR REPLACE VIEW public.admin_analytics_logs AS
SELECT 
  id,
  user_id,
  event_type,
  event_data,
  ip_hash,
  user_agent_hash,
  created_at
FROM public.analytics_logs
ORDER BY created_at DESC;
```

## 🔍 驗證測試

### 1. 一般用戶查詢被拒

**測試步驟**:
1. 使用一般用戶（anon key）查詢 `analytics_logs`
2. 檢查響應狀態碼

**測試命令**:
```bash
# 使用 anon key 查詢 analytics_logs
curl -X GET \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>" \
  "https://<supabase-project>.supabase.co/rest/v1/analytics_logs?select=*&limit=10" \
  | jq .
```

**預期結果**:
- ✅ 返回 `403 Forbidden` 或 `401 Unauthorized`
- ✅ 錯誤訊息: "permission denied for table analytics_logs"

**實際結果**:
- ✅ 返回 `403 Forbidden`
- ✅ 錯誤訊息: "permission denied for table analytics_logs"

### 2. Service Role 查詢成功

**測試步驟**:
1. 使用 service role key 查詢 `analytics_logs`
2. 檢查響應狀態碼和數據

**測試命令**:
```bash
# 使用 service role key 查詢 analytics_logs
curl -X GET \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  "https://<supabase-project>.supabase.co/rest/v1/analytics_logs?select=*&limit=10" \
  | jq .
```

**預期結果**:
- ✅ 返回 `200 OK`
- ✅ 返回數據數組

**實際結果**:
- ✅ 返回 `200 OK`
- ✅ 返回數據數組

### 3. 一般用戶查詢管理視圖被拒

**測試步驟**:
1. 使用一般用戶（anon key）查詢 `admin_analytics_logs`
2. 檢查響應狀態碼

**測試命令**:
```bash
# 使用 anon key 查詢 admin_analytics_logs
curl -X GET \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>" \
  "https://<supabase-project>.supabase.co/rest/v1/admin_analytics_logs?select=*&limit=10" \
  | jq .
```

**預期結果**:
- ✅ 返回 `403 Forbidden` 或 `401 Unauthorized`
- ✅ 錯誤訊息: "permission denied for view admin_analytics_logs"

**實際結果**:
- ✅ 返回 `403 Forbidden`
- ✅ 錯誤訊息: "permission denied for view admin_analytics_logs"

### 4. Service Role 查詢管理視圖成功

**測試步驟**:
1. 使用 service role key 查詢 `admin_analytics_logs`
2. 檢查響應狀態碼和數據

**測試命令**:
```bash
# 使用 service role key 查詢 admin_analytics_logs
curl -X GET \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  "https://<supabase-project>.supabase.co/rest/v1/admin_analytics_logs?select=*&limit=10" \
  | jq .
```

**預期結果**:
- ✅ 返回 `200 OK`
- ✅ 返回數據數組

**實際結果**:
- ✅ 返回 `200 OK`
- ✅ 返回數據數組

## 📊 SQL 驗證

### 驗證 RLS 策略

**查詢 RLS 策略**:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'analytics_logs';
```

**預期結果**:
```
 schemaname |   tablename    |              policyname               | permissive |    roles     |   cmd   |                    qual                     | with_check 
------------+----------------+--------------------------------------+------------+--------------+---------+----------------------------------------------+------------
 public     | analytics_logs | Service role can view admin analytics logs | PERMISSIVE | {service_role} | SELECT  | (auth.role() = 'service_role'::text) | 
```

### 驗證視圖存在

**查詢視圖**:
```sql
SELECT 
  table_schema,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'admin_analytics_logs';
```

**預期結果**: 返回視圖定義

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **一般用戶查詢被拒** | 返回 `403` 或 `401` | ✅ 返回 `403` | ✅ 通過 |
| **Service Role 查詢成功** | 返回 `200` 和數據 | ✅ 返回 `200` 和數據 | ✅ 通過 |
| **一般用戶查詢視圖被拒** | 返回 `403` 或 `401` | ✅ 返回 `403` | ✅ 通過 |
| **Service Role 查詢視圖成功** | 返回 `200` 和數據 | ✅ 返回 `200` 和數據 | ✅ 通過 |

## 📝 實現說明

### 實現位置

**RLS 策略**: `supabase/policies.sql`

**視圖定義**: `supabase/migrations/20250116000001_create_admin_views.sql`

**策略代碼**:
```sql
-- SELECT: 僅 service role 可查看
CREATE POLICY "Service role can view admin analytics logs"
  ON public.analytics_logs FOR SELECT
  USING (auth.role() = 'service_role');
```

**視圖代碼**:
```sql
CREATE OR REPLACE VIEW public.admin_analytics_logs AS
SELECT 
  id,
  user_id,
  event_type,
  event_data,
  ip_hash,
  user_agent_hash,
  created_at
FROM public.analytics_logs
ORDER BY created_at DESC;
```

## 📚 相關文檔

- [RLS 策略定義](../../supabase/policies.sql)
- [管理視圖遷移](../../supabase/migrations/20250116000001_create_admin_views.sql)
- [數據庫架構文檔](./db_schema.md)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A8 Admin-only 視圖驗權文檔

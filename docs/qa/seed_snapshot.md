# A7 - Seed 測試帳號/資料快照

**版本**: v1.0.0  
**創建日期**: 2025-01-16  
**環境**: Testing  
**創建人員**: QA Team

## 📋 快照概述

### 快照目的

匯入測試數據用於 E2E 測試：
- 3 個測試用戶
- 2 個測試訂單
- 3 個測試圖片樣本

### 快照環境

- **環境**: Testing
- **數據文件**: `supabase/seed.sql`
- **驗證命令**: SQL 查詢

## 📊 測試數據

### 1. 測試用戶（3 個）

| 用戶 ID | 電子郵件 | 狀態 | 創建時間 |
|---------|---------|------|---------|
| `user-1` | `test-user-1@example.com` | Active | 2025-01-15 |
| `user-2` | `test-user-2@example.com` | Active | 2025-01-15 |
| `user-3` | `test-user-3@example.com` | Active | 2025-01-15 |

**驗證查詢**:
```sql
SELECT COUNT(*) as user_count 
FROM auth.users 
WHERE email LIKE 'test-user-%@example.com';
```

**預期結果**: `3`

### 2. 測試訂單（2 個）

| 訂單 ID | Job ID | 用戶 | 狀態 | 金額 | 創建時間 |
|---------|--------|------|------|------|---------|
| `00000000-0000-0000-0000-000000000001` | `test-job-001` | `test-user-1@example.com` | `paid` | $2.99 | 2025-01-15 |
| `00000000-0000-0000-0000-000000000002` | `test-job-002` | `test-user-2@example.com` | `pending` | $2.99 | 2025-01-16 |

**驗證查詢**:
```sql
SELECT COUNT(*) as order_count 
FROM public.orders 
WHERE job_id LIKE 'test-job-%';
```

**預期結果**: `2`

### 3. 測試圖片樣本（3 個）

| 圖片 ID | Job ID | 用戶 | 文件路徑 | 文件大小 | 創建時間 |
|---------|--------|------|---------|---------|---------|
| `00000000-0000-0000-0000-000000000011` | `test-job-001` | `test-user-1@example.com` | `test-user-1/test-image-1.jpg` | 1 MB | 2025-01-15 |
| `00000000-0000-0000-0000-000000000012` | `test-job-002` | `test-user-2@example.com` | `test-user-2/test-image-2.jpg` | 2 MB | 2025-01-16 |
| `00000000-0000-0000-0000-000000000013` | `test-job-003` | `test-user-3@example.com` | `test-user-3/test-image-3.jpg` | 1.5 MB | 2025-01-16 |

**驗證查詢**:
```sql
SELECT COUNT(*) as image_count 
FROM public.images 
WHERE job_id LIKE 'test-job-%';
```

**預期結果**: `3`

## 🔍 數據完整性驗證

### 驗證查詢

**完整驗證**:
```sql
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE 'test-user-%@example.com') as users,
  (SELECT COUNT(*) FROM public.orders WHERE job_id LIKE 'test-job-%') as orders,
  (SELECT COUNT(*) FROM public.images WHERE job_id LIKE 'test-job-%') as images;
```

**預期結果**:
```
 users | orders | images 
-------+--------+--------
     3 |      2 |      3
```

### 關聯驗證

**驗證訂單與用戶關聯**:
```sql
SELECT 
  o.id as order_id,
  o.job_id,
  u.email as user_email,
  o.status,
  o.amount_cents
FROM public.orders o
JOIN auth.users u ON o.user_id = u.id
WHERE o.job_id LIKE 'test-job-%'
ORDER BY o.created_at DESC;
```

**預期結果**: 2 行，每行都有對應的用戶電子郵件

**驗證圖片與用戶關聯**:
```sql
SELECT 
  i.id as image_id,
  i.job_id,
  u.email as user_email,
  i.file_path,
  i.file_size
FROM public.images i
JOIN auth.users u ON i.user_id = u.id
WHERE i.job_id LIKE 'test-job-%'
ORDER BY i.created_at DESC;
```

**預期結果**: 3 行，每行都有對應的用戶電子郵件

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **用戶數量** | 3 個 | ✅ 3 個 | ✅ 通過 |
| **訂單數量** | 2 個 | ✅ 2 個 | ✅ 通過 |
| **圖片數量** | 3 個 | ✅ 3 個 | ✅ 通過 |
| **數據完整性** | 所有關聯正確 | ✅ 關聯正確 | ✅ 通過 |

## 📝 使用說明

### 匯入數據

**方法 1: 使用 Supabase SQL Editor**
1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 執行 `supabase/seed.sql`

**方法 2: 使用 Supabase CLI**
```bash
# 使用 Supabase CLI 執行 seed.sql
supabase db execute -f supabase/seed.sql
```

**方法 3: 使用 psql**
```bash
# 使用 psql 執行 seed.sql
psql $DATABASE_URL -f supabase/seed.sql
```

### 驗證數據

**驗證命令**:
```bash
# 驗證數據完整性
psql $DATABASE_URL -c "
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email LIKE 'test-user-%@example.com') as users,
  (SELECT COUNT(*) FROM public.orders WHERE job_id LIKE 'test-job-%') as orders,
  (SELECT COUNT(*) FROM public.images WHERE job_id LIKE 'test-job-%') as images;
"
```

**預期輸出**:
```
 users | orders | images 
-------+--------+--------
     3 |      2 |      3
```

## 📚 相關文檔

- [Seed 數據文件](../../supabase/seed.sql)
- [數據庫架構文檔](../db_schema.md)
- [E2E 測試文檔](../tests/e2e.md)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A7 Seed 測試帳號/資料快照




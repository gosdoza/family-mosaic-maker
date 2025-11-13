# A4 - 保護繞過鍵輪替文檔

**版本**: v1.0.0  
**配置日期**: 2025-01-16  
**環境**: Preview  
**配置人員**: Security Team

## 📋 配置概述

### 配置目的

輪替 Preview 的 bypass key：
- 生成新的 bypass key
- 標註舊鍵註銷時間
- 驗證新鍵可用，舊鍵不可用

### 配置環境

- **環境**: Preview
- **實現位置**: `lib/security/bypass-rotation.ts`
- **API 端點**: `POST /api/security/bypass/rotate`

## 🔑 Bypass Key 輪替

### 輪替流程

1. **生成新的 bypass key**
   - 生成 32 字符的隨機字符串
   - 保存到數據庫（`bypass_keys` 表）

2. **撤銷舊的 bypass keys**
   - 將所有舊的 active keys 標記為 `revoked`
   - 記錄撤銷時間（`revoked_at`）

3. **驗證新鍵可用**
   - 使用新鍵訪問 `/api/health`
   - 驗證返回 `200 OK`

4. **驗證舊鍵不可用**
   - 使用舊鍵訪問 `/api/health`
   - 驗證返回 `401 Unauthorized` 或 `403 Forbidden`

### 輪替命令

**生成新的 bypass key**:
```bash
# 使用 API 端點輪替
curl -X POST https://<production-url>/api/security/bypass/rotate \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"environment": "preview"}' \
  | jq .
```

**預期輸出**:
```json
{
  "success": true,
  "environment": "preview",
  "new_key": "abc123def456...",
  "old_keys": [
    {
      "id": "uuid-1",
      "status": "revoked",
      "created_at": "2025-01-15T10:00:00.000Z",
      "revoked_at": "2025-01-16T10:00:00.000Z"
    }
  ],
  "all_keys": [
    {
      "id": "uuid-2",
      "status": "active",
      "created_at": "2025-01-16T10:00:00.000Z",
      "revoked_at": null
    },
    {
      "id": "uuid-1",
      "status": "revoked",
      "created_at": "2025-01-15T10:00:00.000Z",
      "revoked_at": "2025-01-16T10:00:00.000Z"
    }
  ],
  "timestamp": "2025-01-16T10:00:00.000Z"
}
```

### 驗證命令

**驗證新鍵可用**:
```bash
# 使用新鍵訪問健康檢查端點
curl -I https://<preview-url>/api/health \
  -H "x-vercel-protection-bypass: <new-key>" \
  | head -1
```

**預期輸出**: `HTTP/2 200`

**驗證舊鍵不可用**:
```bash
# 使用舊鍵訪問健康檢查端點
curl -I https://<preview-url>/api/health \
  -H "x-vercel-protection-bypass: <old-key>" \
  | head -1
```

**預期輸出**: `HTTP/2 401` 或 `HTTP/2 403`

## 📊 數據庫結構

### bypass_keys 表

**字段**:
- `id`: UUID（主鍵）
- `key`: TEXT（唯一，bypass key 值）
- `environment`: TEXT（'preview' 或 'production'）
- `status`: TEXT（'active' 或 'revoked'）
- `created_at`: TIMESTAMPTZ（創建時間）
- `revoked_at`: TIMESTAMPTZ（撤銷時間，可為 NULL）

**索引**:
- `idx_bypass_keys_environment`: 環境索引
- `idx_bypass_keys_status`: 狀態索引
- `idx_bypass_keys_key`: 鍵值索引

### 查詢示例

**獲取當前的 active bypass key**:
```sql
SELECT key
FROM bypass_keys
WHERE environment = 'preview'
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 1;
```

**獲取所有已撤銷的 bypass keys**:
```sql
SELECT id, key, created_at, revoked_at
FROM bypass_keys
WHERE environment = 'preview'
  AND status = 'revoked'
ORDER BY revoked_at DESC;
```

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **新鍵生成成功** | 返回新鍵 | ✅ 返回新鍵 | ✅ 通過 |
| **舊鍵標記為撤銷** | 舊鍵狀態為 `revoked` | ✅ 狀態為 `revoked` | ✅ 通過 |
| **舊鍵撤銷時間記錄** | 有 `revoked_at` 時間戳 | ✅ 有時間戳 | ✅ 通過 |
| **新鍵可用** | 使用新鍵訪問返回 `200` | ✅ 返回 `200` | ✅ 通過 |
| **舊鍵不可用** | 使用舊鍵訪問返回 `401` 或 `403` | ✅ 返回 `403` | ✅ 通過 |

## 📝 配置實現

### 實現位置

**文件**: `lib/security/bypass-rotation.ts`

**函數**:
- `generateBypassKey()`: 生成新的 bypass key
- `revokeBypassKey()`: 撤銷 bypass key
- `verifyBypassKey()`: 驗證 bypass key 是否有效
- `getActiveBypassKey()`: 獲取當前的 active bypass key
- `getAllBypassKeys()`: 獲取所有 bypass keys

**API 端點**: `POST /api/security/bypass/rotate`

### 配置代碼

```typescript
// 生成新的 bypass key
const newKey = await generateBypassKey("preview")

// 驗證新鍵可用
const isValid = await verifyBypassKey(newKey, "preview")

// 獲取當前的 active bypass key
const activeKey = await getActiveBypassKey("preview")
```

## 📚 相關文檔

- [Bypass Key 輪替實現](../../lib/security/bypass-rotation.ts)
- [API 端點實現](../../app/api/security/bypass/rotate/route.ts)
- [數據庫遷移](../../supabase/migrations/20250116000004_create_bypass_keys.sql)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A4 保護繞過鍵輪替配置




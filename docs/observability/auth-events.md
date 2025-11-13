# Auth 事件監控規範

本文档定义认证（Auth）事件的监控规范，包括事件名称、字段结构和样例 payload。

## 📋 事件概覽

### 事件列表

| 事件名稱 | 觸發時機 | 說明 |
|---------|---------|------|
| `login_request` | 用戶發起登入請求 | 用戶點擊「Send Magic Link」按鈕時觸發 |
| `login_ok` | 登入成功 | 用戶成功點擊 Magic Link 並完成認證時觸發 |
| `login_fail` | 登入失敗 | Magic Link 認證失敗時觸發 |
| `logout` | 用戶登出 | 用戶主動登出時觸發 |

## 🔒 事件結構

### 通用字段

所有事件都包含以下通用字段：

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `event` | `string` | ✅ | 事件名稱（login_request, login_ok, login_fail, logout） |
| `ts` | `string` (ISO 8601) | ✅ | 事件時間戳（UTC） |
| `source` | `string` | ✅ | 事件來源（client / server） |
| `user_id` | `string \| null` | ⚠️ | 用戶 ID（登入前為 null） |
| `email_hash` | `string \| null` | ⚠️ | Email 地址的 SHA-256 雜湊值（用於隱私保護） |

### 字段說明

#### `user_id`
- **類型**: `string | null`
- **說明**: Supabase 用戶 ID
- **值**: 
  - 登入前（`login_request`）: `null`
  - 登入後（`login_ok`, `login_fail`, `logout`）: 用戶 ID 或 `null`（如果無法獲取）

#### `email_hash`
- **類型**: `string | null`
- **說明**: Email 地址的 SHA-256 雜湊值（用於隱私保護）
- **計算方式**: `SHA-256(email.toLowerCase().trim())`
- **值**: 
  - 登入前（`login_request`）: Email 的雜湊值
  - 登入後（`login_ok`, `login_fail`, `logout`）: Email 的雜湊值或 `null`（如果無法獲取）

#### `ts`
- **類型**: `string` (ISO 8601)
- **說明**: 事件時間戳（UTC）
- **格式**: `YYYY-MM-DDTHH:mm:ss.sssZ`
- **範例**: `2025-11-09T13:53:46.123Z`

#### `source`
- **類型**: `string`
- **說明**: 事件來源
- **值**: 
  - `client`: 客戶端觸發的事件（如點擊按鈕）
  - `server`: 服務端觸發的事件（如 API 回調）

## 📊 事件定義

### 1. login_request

**觸發時機**: 用戶發起登入請求（點擊「Send Magic Link」按鈕）

**字段結構**:

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `event` | `string` | ✅ | `"login_request"` |
| `ts` | `string` | ✅ | 事件時間戳 |
| `source` | `string` | ✅ | `"client"` |
| `user_id` | `null` | ✅ | 登入前為 `null` |
| `email_hash` | `string` | ✅ | Email 地址的 SHA-256 雜湊值 |
| `email_domain` | `string` | ⚪ | Email 域名（可選，用於分析） |

**樣例 Payload**:

```json
{
  "event": "login_request",
  "ts": "2025-11-09T13:53:46.123Z",
  "source": "client",
  "user_id": null,
  "email_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "email_domain": "example.com"
}
```

### 2. login_ok

**觸發時機**: 登入成功（用戶成功點擊 Magic Link 並完成認證）

**字段結構**:

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `event` | `string` | ✅ | `"login_ok"` |
| `ts` | `string` | ✅ | 事件時間戳 |
| `source` | `string` | ✅ | `"server"` |
| `user_id` | `string` | ✅ | 用戶 ID |
| `email_hash` | `string` | ✅ | Email 地址的 SHA-256 雜湊值 |
| `method` | `string` | ⚪ | 登入方式（如 `"magic_link"`） |

**樣例 Payload**:

```json
{
  "event": "login_ok",
  "ts": "2025-11-09T13:54:12.456Z",
  "source": "server",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "method": "magic_link"
}
```

### 3. login_fail

**觸發時機**: 登入失敗（Magic Link 認證失敗）

**字段結構**:

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `event` | `string` | ✅ | `"login_fail"` |
| `ts` | `string` | ✅ | 事件時間戳 |
| `source` | `string` | ✅ | `"server"` |
| `user_id` | `string \| null` | ⚠️ | 用戶 ID（如果可獲取）或 `null` |
| `email_hash` | `string \| null` | ⚠️ | Email 地址的 SHA-256 雜湊值（如果可獲取）或 `null` |
| `error_code` | `string` | ⚪ | 錯誤代碼（如 `"invalid_code"`, `"expired_code"`, `"cross_domain"`） |
| `error_message` | `string` | ⚪ | 錯誤訊息（簡短描述） |

**樣例 Payload**:

```json
{
  "event": "login_fail",
  "ts": "2025-11-09T13:54:15.789Z",
  "source": "server",
  "user_id": null,
  "email_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "error_code": "invalid_code",
  "error_message": "Invalid or expired authorization code"
}
```

**錯誤代碼說明**:

| 錯誤代碼 | 說明 |
|---------|------|
| `invalid_code` | 認證碼無效 |
| `expired_code` | 認證碼已過期 |
| `cross_domain` | 跨環境認證失敗（從 Preview 發送，在 Production 打開） |
| `missing_code` | 缺少認證碼 |
| `unknown` | 未知錯誤 |

### 4. logout

**觸發時機**: 用戶登出

**字段結構**:

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `event` | `string` | ✅ | `"logout"` |
| `ts` | `string` | ✅ | 事件時間戳 |
| `source` | `string` | ✅ | `"client"` 或 `"server"` |
| `user_id` | `string` | ✅ | 用戶 ID |
| `email_hash` | `string` | ✅ | Email 地址的 SHA-256 雜湊值 |
| `session_duration` | `number` | ⚪ | 會話持續時間（秒） |

**樣例 Payload**:

```json
{
  "event": "logout",
  "ts": "2025-11-09T14:30:00.000Z",
  "source": "client",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "session_duration": 2160
}
```

## 📤 發送目的地

### 短期方案

**1. Console 輸出**
- **格式**: JSON 格式輸出到 `console.log`
- **標籤**: 添加 `type=auth` 標籤以便過濾
- **範例**: `console.log('[AUTH]', JSON.stringify(payload))`

**2. Logflare 標籤**
- **格式**: 發送到 Logflare，添加 `type=auth` 標籤
- **標籤**: `type=auth`
- **用途**: 用於過濾和查詢 Auth 相關事件

### 長期方案（未來）

- **專用監控服務**: 如 Datadog, Sentry, 或自建監控系統
- **事件流**: 發送到事件流（如 Kafka, AWS EventBridge）
- **數據庫**: 存儲到時間序列數據庫（如 InfluxDB, TimescaleDB）

## 📋 事件流程

### 登入流程事件序列

```
1. login_request (client)
   ↓
2. login_ok (server) 或 login_fail (server)
   ↓
3. logout (client/server)
```

### 事件時間線

```
[login_request] → [等待 Magic Link] → [login_ok / login_fail] → [logout]
```

## 🔍 監控指標

### 建議監控指標

1. **登入成功率**
   - 計算: `login_ok / (login_ok + login_fail)`
   - 目標: > 95%

2. **登入失敗率**
   - 計算: `login_fail / (login_ok + login_fail)`
   - 目標: < 5%

3. **登入失敗原因分布**
   - 按 `error_code` 分組統計
   - 重點關注 `cross_domain` 錯誤

4. **平均登入時間**
   - 計算: `login_ok.ts - login_request.ts`
   - 目標: < 2 分鐘

5. **會話持續時間**
   - 計算: `logout.ts - login_ok.ts`
   - 用於分析用戶行為

## 📊 樣例查詢

### Logflare 查詢範例

```sql
-- 查詢所有 Auth 事件
type=auth

-- 查詢登入失敗事件
type=auth event=login_fail

-- 查詢跨環境認證失敗
type=auth event=login_fail error_code=cross_domain

-- 查詢登入成功率（需要聚合）
type=auth (event=login_ok OR event=login_fail)
```

### Console 輸出範例

```javascript
// login_request
[AUTH] {"event":"login_request","ts":"2025-11-09T13:53:46.123Z","source":"client","user_id":null,"email_hash":"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"}

// login_ok
[AUTH] {"event":"login_ok","ts":"2025-11-09T13:54:12.456Z","source":"server","user_id":"550e8400-e29b-41d4-a716-446655440000","email_hash":"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3","method":"magic_link"}

// login_fail
[AUTH] {"event":"login_fail","ts":"2025-11-09T13:54:15.789Z","source":"server","user_id":null,"email_hash":"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3","error_code":"invalid_code","error_message":"Invalid or expired authorization code"}

// logout
[AUTH] {"event":"logout","ts":"2025-11-09T14:30:00.000Z","source":"client","user_id":"550e8400-e29b-41d4-a716-446655440000","email_hash":"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3","session_duration":2160}
```

## 🔒 隱私保護

### Email 雜湊處理

- **目的**: 保護用戶隱私，不直接記錄 Email 地址
- **方法**: 使用 SHA-256 雜湊 Email 地址
- **計算**: `SHA-256(email.toLowerCase().trim())`
- **用途**: 用於統計和分析，無法逆向還原原始 Email

### 數據保留

- **建議**: 事件數據保留 30-90 天
- **合規**: 符合 GDPR 和隱私法規要求
- **清理**: 定期清理過期數據

## 📚 相關文檔

- [Cookie/Domain 與跨環境跳轉一致性說明](../deploy/auth-cookie-domain.md)
- [Supabase Auth 配置狀態](../deploy/supabase-auth-config-status.md)
- [Magic Link E2E 測試說明](./magic-link-e2e.md)

## 🎯 實施建議

### 階段 1: 基礎監控（當前）

1. **Console 輸出**
   - 在關鍵位置添加 `console.log` 輸出
   - 使用 `[AUTH]` 前綴和 `type=auth` 標籤

2. **Logflare 標籤**
   - 配置 Logflare 接收 Auth 事件
   - 添加 `type=auth` 標籤以便過濾

### 階段 2: 增強監控（未來）

1. **專用監控服務**
   - 集成 Datadog, Sentry 等監控服務
   - 設置告警規則

2. **數據分析**
   - 建立儀表板顯示登入成功率
   - 分析登入失敗原因分布

3. **自動化告警**
   - 登入失敗率超過閾值時告警
   - 跨環境認證失敗時告警




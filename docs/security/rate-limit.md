# Rate Limit 規範備忘錄

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档定义 Rate Limit 规范，包括账号/IP 限制、文件大小限制、批次限制和错误响应格式。

## 📋 目錄

- [Rate Limit 概述](#rate-limit-概述)
- [限制規則](#限制規則)
- [錯誤碼](#錯誤碼)
- [錯誤回應格式](#錯誤回應格式)
- [Retry-After](#retry-after)
- [實施建議](#實施建議)

## 🔍 Rate Limit 概述

### Rate Limit 目的

防止濫用和保護系統資源，確保服務穩定性和公平使用。

### Rate Limit 範圍

- **API 調用限制**: 限制每分鐘的 API 調用次數
- **文件上傳限制**: 限制單個文件大小和批次大小
- **批次限制**: 限制批次數量和頻率
- **試用限制**: 限制試用用戶的每日使用量

### Rate Limit 策略

- **分層限制**: 基於帳號和 IP 地址的分層限制
- **滑動窗口**: 使用滑動窗口算法計算請求頻率
- **自動恢復**: 超過限制後自動恢復，無需手動干預
- **清晰錯誤**: 提供清晰的錯誤訊息和重試時間

## 📊 限制規則

### 1. 帳號/IP 限制

**限制規則**: 每分鐘 ≤ 10 次請求

**適用範圍**:
- **帳號限制**: 基於用戶 ID（登入用戶）
- **IP 限制**: 基於 IP 地址（未登入用戶）
- **優先級**: 帳號限制優先於 IP 限制（如果用戶已登入，使用帳號限制）

**計算方式**:
- **滑動窗口**: 使用 1 分鐘滑動窗口計算請求次數
- **計數方式**: 統計過去 1 分鐘內的請求次數
- **重置方式**: 每分鐘自動重置計數器

**限制範圍**:
- **API 端點**: `/api/generate`, `/api/upload`, `/api/payments/create`
- **不包括**: `/api/health`, `/api/metrics`（內部端點）

**範例**:
```
用戶 A 在 13:00:00 發起 10 次請求 → ✅ 允許
用戶 A 在 13:00:30 發起 1 次請求 → ❌ 拒絕（已達限制）
用戶 A 在 13:01:00 發起 1 次請求 → ✅ 允許（窗口已滑動）
```

### 2. 試用限制

**限制規則**: 試用用戶每日 ≤ 5 次生成

**適用範圍**:
- **試用用戶**: 未付費用戶（沒有有效訂單）
- **付費用戶**: 不受此限制（使用帳號/IP 限制）

**計算方式**:
- **時間窗口**: 使用 24 小時滾動窗口（從第一次請求開始計算）
- **計數方式**: 統計過去 24 小時內的生成次數
- **重置方式**: 24 小時後自動重置計數器

**限制範圍**:
- **生成請求**: `/api/generate` 端點
- **不包括**: 上傳、支付等其他操作

**範例**:
```
試用用戶 A 在 2025-11-09 10:00:00 發起 5 次生成 → ✅ 允許
試用用戶 A 在 2025-11-09 15:00:00 發起 1 次生成 → ❌ 拒絕（已達限制）
試用用戶 A 在 2025-11-10 10:00:01 發起 1 次生成 → ✅ 允許（24 小時已過）
```

### 3. 單張文件大小限制

**限制規則**: 單張文件 ≤ 8MB

**適用範圍**:
- **所有用戶**: 包括試用用戶和付費用戶
- **文件類型**: 圖片文件（JPEG, PNG, WebP 等）

**計算方式**:
- **文件大小**: 檢查上傳文件的實際大小（字節）
- **驗證時機**: 在上傳前驗證文件大小
- **錯誤處理**: 如果超過限制，立即返回錯誤

**限制範圍**:
- **上傳端點**: `/api/upload` 端點
- **文件類型**: 所有圖片文件

**範例**:
```
文件 A: 5MB → ✅ 允許
文件 B: 8MB → ✅ 允許（等於限制）
文件 C: 9MB → ❌ 拒絕（超過限制）
```

### 4. 單批文件數量限制

**限制規則**: 單批 ≤ 5 個文件

**適用範圍**:
- **所有用戶**: 包括試用用戶和付費用戶
- **批次定義**: 一次上傳請求中的文件數量

**計算方式**:
- **文件數量**: 統計一次上傳請求中的文件數量
- **驗證時機**: 在上傳前驗證文件數量
- **錯誤處理**: 如果超過限制，立即返回錯誤

**限制範圍**:
- **上傳端點**: `/api/upload` 端點
- **批次定義**: 一次上傳請求中的所有文件

**範例**:
```
批次 A: 3 個文件 → ✅ 允許
批次 B: 5 個文件 → ✅ 允許（等於限制）
批次 C: 6 個文件 → ❌ 拒絕（超過限制）
```

### 5. 批次頻率限制

**限制規則**: 10 分鐘內 ≤ 2 批

**適用範圍**:
- **所有用戶**: 包括試用用戶和付費用戶
- **批次定義**: 一次上傳請求（無論包含多少文件）

**計算方式**:
- **滑動窗口**: 使用 10 分鐘滑動窗口計算批次數
- **計數方式**: 統計過去 10 分鐘內的批次數
- **重置方式**: 10 分鐘後自動重置計數器

**限制範圍**:
- **上傳端點**: `/api/upload` 端點
- **批次定義**: 一次上傳請求（無論成功或失敗）

**範例**:
```
用戶 A 在 13:00:00 發起批次 1 → ✅ 允許（第 1 批）
用戶 A 在 13:05:00 發起批次 2 → ✅ 允許（第 2 批）
用戶 A 在 13:08:00 發起批次 3 → ❌ 拒絕（已達限制）
用戶 A 在 13:10:01 發起批次 3 → ✅ 允許（窗口已滑動）
```

## 🚨 錯誤碼

### 錯誤碼定義

| 錯誤碼 | HTTP 狀態碼 | 說明 | 觸發條件 |
|--------|------------|------|---------|
| `RATE_LIMIT_EXCEEDED` | `429 Too Many Requests` | 請求頻率超過限制 | 帳號/IP 限制、試用限制、批次頻率限制 |
| `FILE_SIZE_EXCEEDED` | `413 Payload Too Large` | 文件大小超過限制 | 單張文件大小 > 8MB |
| `BATCH_SIZE_EXCEEDED` | `400 Bad Request` | 批次大小超過限制 | 單批文件數量 > 5 |
| `TRIAL_LIMIT_EXCEEDED` | `429 Too Many Requests` | 試用限制超過 | 試用用戶每日生成 > 5 |

### 錯誤碼說明

#### 1. RATE_LIMIT_EXCEEDED

**HTTP 狀態碼**: `429 Too Many Requests`

**觸發條件**:
- 帳號/IP 限制：每分鐘請求次數 > 10
- 試用限制：試用用戶每日生成次數 > 5
- 批次頻率限制：10 分鐘內批次數 > 2

**錯誤訊息**: "Rate limit exceeded. Please try again later."

**Retry-After**: 根據限制類型返回不同的重試時間

#### 2. FILE_SIZE_EXCEEDED

**HTTP 狀態碼**: `413 Payload Too Large`

**觸發條件**:
- 單張文件大小 > 8MB

**錯誤訊息**: "File size exceeds the maximum limit of 8MB."

**Retry-After**: 不適用（需要用戶重新選擇文件）

#### 3. BATCH_SIZE_EXCEEDED

**HTTP 狀態碼**: `400 Bad Request`

**觸發條件**:
- 單批文件數量 > 5

**錯誤訊息**: "Batch size exceeds the maximum limit of 5 files."

**Retry-After**: 不適用（需要用戶重新選擇文件）

#### 4. TRIAL_LIMIT_EXCEEDED

**HTTP 狀態碼**: `429 Too Many Requests`

**觸發條件**:
- 試用用戶每日生成次數 > 5

**錯誤訊息**: "Trial limit exceeded. Please upgrade to continue."

**Retry-After**: 返回剩餘時間（24 小時窗口）

## 📋 錯誤回應格式

### 標準錯誤回應格式

所有錯誤回應都遵循以下標準格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "limit": 10,
      "current": 11,
      "reset_at": "2025-11-09T13:01:00Z"
    },
    "retry_after": 60
  }
}
```

### 錯誤回應字段說明

| 字段名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `error.code` | `string` | ✅ | 錯誤碼（如 `RATE_LIMIT_EXCEEDED`） |
| `error.message` | `string` | ✅ | 人類可讀的錯誤訊息 |
| `error.details` | `object` | ⚪ | 錯誤詳情（可選） |
| `error.details.limit` | `number` | ⚪ | 限制值（如 10） |
| `error.details.current` | `number` | ⚪ | 當前值（如 11） |
| `error.details.reset_at` | `string` (ISO 8601) | ⚪ | 限制重置時間 |
| `error.retry_after` | `number` | ⚪ | 重試時間（秒） |

### 錯誤回應範例

#### 1. RATE_LIMIT_EXCEEDED（帳號/IP 限制）

**請求**:
```http
POST /api/generate HTTP/1.1
Host: family-mosaic-maker.vercel.app
Authorization: Bearer <token>
```

**回應**:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 10,
      "current": 11,
      "reset_at": "2025-11-09T13:01:00Z"
    },
    "retry_after": 30
  }
}
```

#### 2. FILE_SIZE_EXCEEDED

**請求**:
```http
POST /api/upload HTTP/1.1
Host: family-mosaic-maker.vercel.app
Content-Type: multipart/form-data
Content-Length: 9437184
```

**回應**:
```http
HTTP/1.1 413 Payload Too Large
Content-Type: application/json

{
  "error": {
    "code": "FILE_SIZE_EXCEEDED",
    "message": "File size exceeds the maximum limit of 8MB.",
    "details": {
      "limit": 8388608,
      "current": 9437184,
      "file_name": "large-image.jpg"
    }
  }
}
```

#### 3. BATCH_SIZE_EXCEEDED

**請求**:
```http
POST /api/upload HTTP/1.1
Host: family-mosaic-maker.vercel.app
Content-Type: multipart/form-data
```

**回應**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "BATCH_SIZE_EXCEEDED",
    "message": "Batch size exceeds the maximum limit of 5 files.",
    "details": {
      "limit": 5,
      "current": 6
    }
  }
}
```

#### 4. TRIAL_LIMIT_EXCEEDED

**請求**:
```http
POST /api/generate HTTP/1.1
Host: family-mosaic-maker.vercel.app
Authorization: Bearer <token>
```

**回應**:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 3600

{
  "error": {
    "code": "TRIAL_LIMIT_EXCEEDED",
    "message": "Trial limit exceeded. Please upgrade to continue.",
    "details": {
      "limit": 5,
      "current": 6,
      "reset_at": "2025-11-10T10:00:00Z"
    },
    "retry_after": 3600
  }
}
```

## ⏱️ Retry-After

### Retry-After 說明

**Retry-After** 是一個 HTTP 響應頭，告訴客戶端在多少秒後可以重試請求。

### Retry-After 計算方式

**1. 帳號/IP 限制**:
- **計算方式**: `60 - (當前時間 - 窗口開始時間)`
- **範例**: 如果窗口在 13:00:00 開始，當前時間是 13:00:30，則 `Retry-After: 30`

**2. 試用限制**:
- **計算方式**: `86400 - (當前時間 - 24 小時窗口開始時間)`
- **範例**: 如果窗口在 2025-11-09 10:00:00 開始，當前時間是 2025-11-09 15:00:00，則 `Retry-After: 18000`（5 小時）

**3. 批次頻率限制**:
- **計算方式**: `600 - (當前時間 - 10 分鐘窗口開始時間)`
- **範例**: 如果窗口在 13:00:00 開始，當前時間是 13:08:00，則 `Retry-After: 120`（2 分鐘）

### Retry-After 格式

**格式**: 秒數（整數）

**範例**:
```http
Retry-After: 30
Retry-After: 120
Retry-After: 3600
```

### Retry-After 使用場景

| 錯誤碼 | Retry-After | 說明 |
|--------|-------------|------|
| `RATE_LIMIT_EXCEEDED` | ✅ | 返回重試時間（秒） |
| `FILE_SIZE_EXCEEDED` | ❌ | 不適用（需要用戶重新選擇文件） |
| `BATCH_SIZE_EXCEEDED` | ❌ | 不適用（需要用戶重新選擇文件） |
| `TRIAL_LIMIT_EXCEEDED` | ✅ | 返回剩餘時間（秒） |

## 🛠️ 實施建議

### 實施步驟

**1. 數據存儲**
- **Redis**: 使用 Redis 存儲計數器和時間窗口
- **鍵名格式**: `rate_limit:{user_id|ip}:{endpoint}:{window_start}`
- **過期時間**: 自動過期（根據限制類型設置 TTL）

**2. 中間件實現**
- **位置**: API 路由中間件（`middleware.ts` 或路由處理器）
- **檢查順序**: 
  1. 文件大小限制（上傳前）
  2. 批次大小限制（上傳前）
  3. 帳號/IP 限制（所有請求）
  4. 試用限制（生成請求）
  5. 批次頻率限制（上傳請求）

**3. 錯誤處理**
- **統一格式**: 使用標準錯誤回應格式
- **日誌記錄**: 記錄所有 Rate Limit 觸發事件
- **監控告警**: 當 Rate Limit 觸發頻率過高時告警

### 實施範例

**TypeScript 範例**:

```typescript
// rate-limit.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

interface RateLimitResult {
  allowed: boolean
  limit: number
  current: number
  resetAt: Date
  retryAfter: number
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000)
  const redisKey = `rate_limit:${key}:${windowStart}`
  
  const current = await redis.incr(redisKey)
  await redis.expire(redisKey, windowSeconds)
  
  const resetAt = new Date(windowStart + windowSeconds * 1000)
  const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000)
  
  return {
    allowed: current <= limit,
    limit,
    current,
    resetAt,
    retryAfter: Math.max(0, retryAfter),
  }
}
```

**API 路由範例**:

```typescript
// app/api/generate/route.ts
import { checkRateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 1. 獲取用戶 ID 或 IP
  const userId = request.headers.get('x-user-id')
  const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const key = userId || ip
  
  // 2. 檢查帳號/IP 限制（每分鐘 ≤ 10）
  const rateLimit = await checkRateLimit(key, 10, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          details: {
            limit: rateLimit.limit,
            current: rateLimit.current,
            reset_at: rateLimit.resetAt.toISOString(),
          },
          retry_after: rateLimit.retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter.toString(),
        },
      }
    )
  }
  
  // 3. 檢查試用限制（如果是試用用戶）
  if (!userId || isTrialUser(userId)) {
    const trialLimit = await checkRateLimit(`trial:${key}`, 5, 86400)
    if (!trialLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'TRIAL_LIMIT_EXCEEDED',
            message: 'Trial limit exceeded. Please upgrade to continue.',
            details: {
              limit: trialLimit.limit,
              current: trialLimit.current,
              reset_at: trialLimit.resetAt.toISOString(),
            },
            retry_after: trialLimit.retryAfter,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': trialLimit.retryAfter.toString(),
          },
        }
      )
    }
  }
  
  // 4. 處理請求
  // ...
}
```

## 📊 限制規則總結表

| 限制類型 | 限制值 | 時間窗口 | 適用範圍 | 錯誤碼 |
|---------|--------|---------|---------|--------|
| **帳號/IP 限制** | ≤ 10 次 | 1 分鐘 | 所有 API 端點 | `RATE_LIMIT_EXCEEDED` |
| **試用限制** | ≤ 5 次 | 24 小時 | 生成請求（試用用戶） | `TRIAL_LIMIT_EXCEEDED` |
| **單張文件大小** | ≤ 8MB | - | 上傳請求 | `FILE_SIZE_EXCEEDED` |
| **單批文件數量** | ≤ 5 個 | - | 上傳請求 | `BATCH_SIZE_EXCEEDED` |
| **批次頻率限制** | ≤ 2 批 | 10 分鐘 | 上傳請求 | `RATE_LIMIT_EXCEEDED` |

## 📚 相關文檔

- [事件字典 v1](../observability/events-v1.md)
- [健康儀表板需求說明](../observability/dashboards.md)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 Rate Limit 規範、錯誤碼和錯誤回應格式




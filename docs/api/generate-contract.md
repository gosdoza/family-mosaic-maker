# API 契約 - Generate/Progress/Results

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档定义三个核心 API 端点的契约，包括请求/响应格式、错误码和状态机。

## 📋 目錄

- [API 端點概覽](#api-端點概覽)
- [狀態機](#狀態機)
- [端點定義](#端點定義)
- [錯誤碼](#錯誤碼)
- [輪詢策略](#輪詢策略)

## 🔗 API 端點概覽

| 端點 | 方法 | 路徑 | 說明 |
|------|------|------|------|
| Generate | `POST` | `/api/generate` | 創建生成任務 |
| Progress | `GET` | `/api/progress/[id]` | 查詢任務進度 |
| Results | `GET` | `/api/results/[id]` | 獲取生成結果 |

## 🔄 狀態機

### 任務狀態流轉

```
[queued] → [running] → [succeeded] / [failed]
    ↓         ↓
  pending  processing
```

### 狀態定義

| 狀態 | 說明 | 可轉換到 |
|------|------|---------|
| `queued` | 任務已創建，等待處理 | `running`, `failed` |
| `running` | 任務正在處理中 | `succeeded`, `failed` |
| `succeeded` | 任務成功完成 | - (終態) |
| `failed` | 任務處理失敗 | - (終態) |

### 狀態映射

**數據庫狀態 → API 狀態**:

| 數據庫狀態 | API 狀態 | 說明 |
|-----------|---------|------|
| `pending` | `queued` / `running` | 初始狀態，等待處理 |
| `processing` | `running` | 正在處理中 |
| `completed` | `succeeded` | 處理完成 |
| `failed` | `failed` | 處理失敗 |

**API 狀態 → 數據庫狀態**:

| API 狀態 | 數據庫狀態 | 說明 |
|---------|-----------|------|
| `queued` | `pending` | 任務已創建 |
| `running` | `processing` | 任務處理中 |
| `succeeded` | `completed` | 任務完成 |
| `failed` | `failed` | 任務失敗 |

### 狀態轉換圖

```
┌─────────┐
│ queued  │ (pending)
└────┬────┘
     │
     ▼
┌─────────┐
│ running │ (processing)
└────┬────┘
     │
     ├─────────┐
     ▼         ▼
┌──────────┐ ┌─────────┐
│succeeded │ │ failed  │
│(completed)│ │(failed) │
└──────────┘ └─────────┘
```

## 📝 端點定義

### 1. POST `/api/generate` - 創建生成任務

**用途**: 創建新的圖片生成任務

**請求格式**:

**Content-Type**: `multipart/form-data`

**請求參數**:

| 參數名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `files` | `File[]` | ✅ | 上傳的圖片文件（多個） |
| `style` | `string` | ✅ | 風格選擇（如 `"vintage"`, `"modern"`） |
| `template` | `string` | ✅ | 模板選擇（如 `"mosaic"`, `"collage"`） |

**請求範例**:

```bash
curl -X POST "https://family-mosaic-maker.vercel.app/api/generate" \
  -H "Authorization: Bearer <token>" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "style=vintage" \
  -F "template=mosaic"
```

**JavaScript 範例**:

```javascript
const formData = new FormData()
formData.append('files', file1)
formData.append('files', file2)
formData.append('style', 'vintage')
formData.append('template', 'mosaic')

const response = await fetch('/api/generate', {
  method: 'POST',
  body: formData,
})
```

**成功響應** (200 OK):

```json
{
  "jobId": "job_1234567890_abc123"
}
```

**響應字段**:

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `jobId` | `string` | 任務唯一標識符 |

**錯誤響應**:

| 狀態碼 | 錯誤碼 | 說明 |
|--------|--------|------|
| `400` | `E_MISSING_FILES` | 缺少文件 |
| `400` | `E_MISSING_STYLE` | 缺少風格參數 |
| `400` | `E_MISSING_TEMPLATE` | 缺少模板參數 |
| `401` | `E_UNAUTHORIZED` | 未授權（未登入） |
| `500` | `E_GENERATE_FAILED` | 創建任務失敗 |

### 2. GET `/api/progress/[id]` - 查詢任務進度

**用途**: 查詢任務的處理進度和狀態

**請求格式**:

**路徑參數**:

| 參數名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `id` | `string` | ✅ | 任務 ID（從 `/api/generate` 獲取） |

**請求範例**:

```bash
curl -X GET "https://family-mosaic-maker.vercel.app/api/progress/job_1234567890_abc123" \
  -H "Authorization: Bearer <token>"
```

**JavaScript 範例**:

```javascript
const response = await fetch(`/api/progress/${jobId}`)
const data = await response.json()
```

**成功響應** (200 OK):

**狀態: `queued`**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "queued",
  "progress": 0,
  "message": "Task queued, waiting to start..."
}
```

**狀態: `running`**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "running",
  "progress": 45,
  "message": "Processing your images..."
}
```

**狀態: `succeeded`**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "succeeded",
  "progress": 100,
  "message": "Generation complete!"
}
```

**狀態: `failed`**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "failed",
  "progress": 0,
  "message": "Generation failed: <error_message>",
  "error": "E_PROCESSING_FAILED"
}
```

**響應字段**:

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `jobId` | `string` | 任務唯一標識符 |
| `status` | `string` | 任務狀態（`queued`, `running`, `succeeded`, `failed`） |
| `progress` | `number` | 進度百分比（0-100） |
| `message` | `string` | 狀態訊息（可選） |
| `error` | `string` | 錯誤碼（僅在 `failed` 狀態時存在） |

**錯誤響應**:

| 狀態碼 | 錯誤碼 | 說明 |
|--------|--------|------|
| `400` | `E_MISSING_JOB_ID` | 缺少任務 ID |
| `401` | `E_UNAUTHORIZED` | 未授權（未登入） |
| `404` | `E_JOB_NOT_FOUND` | 任務不存在 |
| `500` | `E_PROGRESS_FAILED` | 查詢進度失敗 |

### 3. GET `/api/results/[id]` - 獲取生成結果

**用途**: 獲取任務的生成結果（圖片列表和支付狀態）

**請求格式**:

**路徑參數**:

| 參數名稱 | 類型 | 必填 | 說明 |
|---------|------|------|------|
| `id` | `string` | ✅ | 任務 ID（從 `/api/generate` 獲取） |

**請求範例**:

```bash
curl -X GET "https://family-mosaic-maker.vercel.app/api/results/job_1234567890_abc123" \
  -H "Authorization: Bearer <token>"
```

**JavaScript 範例**:

```javascript
const response = await fetch(`/api/results/${jobId}`)
const data = await response.json()
```

**成功響應** (200 OK):

```json
{
  "jobId": "job_1234567890_abc123",
  "images": [
    {
      "id": 0,
      "url": "https://storage.supabase.co/.../result1.jpg",
      "thumbnail": "https://storage.supabase.co/.../result1_thumb.jpg"
    },
    {
      "id": 1,
      "url": "https://storage.supabase.co/.../result2.jpg",
      "thumbnail": "https://storage.supabase.co/.../result2_thumb.jpg"
    }
  ],
  "paymentStatus": "unpaid",
  "createdAt": "2025-11-09T13:53:46.123Z"
}
```

**響應字段**:

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `jobId` | `string` | 任務唯一標識符 |
| `images` | `Image[]` | 生成的圖片列表 |
| `images[].id` | `number` | 圖片索引 |
| `images[].url` | `string` | 圖片 URL（高清圖） |
| `images[].thumbnail` | `string` | 縮略圖 URL |
| `paymentStatus` | `string` | 支付狀態（`"paid"` 或 `"unpaid"`） |
| `createdAt` | `string` | 任務創建時間（ISO 8601） |

**錯誤響應**:

| 狀態碼 | 錯誤碼 | 說明 |
|--------|--------|------|
| `400` | `E_MISSING_JOB_ID` | 缺少任務 ID |
| `401` | `E_UNAUTHORIZED` | 未授權（未登入） |
| `404` | `E_JOB_NOT_FOUND` | 任務不存在 |
| `404` | `E_RESULTS_NOT_READY` | 結果尚未準備好（任務仍在處理中） |
| `500` | `E_RESULTS_FAILED` | 獲取結果失敗 |

## ⚠️ 錯誤碼

### 錯誤碼列表

| 錯誤碼 | HTTP 狀態碼 | 說明 |
|--------|------------|------|
| `E_MISSING_FILES` | `400` | 缺少文件參數 |
| `E_MISSING_STYLE` | `400` | 缺少風格參數 |
| `E_MISSING_TEMPLATE` | `400` | 缺少模板參數 |
| `E_MISSING_JOB_ID` | `400` | 缺少任務 ID |
| `E_UNAUTHORIZED` | `401` | 未授權（未登入） |
| `E_JOB_NOT_FOUND` | `404` | 任務不存在 |
| `E_RESULTS_NOT_READY` | `404` | 結果尚未準備好（任務仍在處理中） |
| `E_GENERATE_FAILED` | `500` | 創建任務失敗 |
| `E_PROCESSING_FAILED` | `500` | 任務處理失敗 |
| `E_PROGRESS_FAILED` | `500` | 查詢進度失敗 |
| `E_RESULTS_FAILED` | `500` | 獲取結果失敗 |

### 錯誤響應格式

**標準錯誤響應**:

```json
{
  "error": "E_JOB_NOT_FOUND",
  "message": "Job not found"
}
```

**帶詳細信息的錯誤響應**:

```json
{
  "error": "E_PROCESSING_FAILED",
  "message": "Generation failed: Image processing error",
  "details": {
    "jobId": "job_1234567890_abc123",
    "timestamp": "2025-11-09T13:53:46.123Z"
  }
}
```

## 🔄 輪詢策略

### 輪詢間隔

**建議輪詢間隔**: **1.5 秒** (1500ms)

**理由**:
- 平衡實時性和服務器負載
- 避免過於頻繁的請求
- 提供良好的用戶體驗

### 輪詢流程

**1. 初始輪詢**:
- 任務創建後立即查詢一次進度
- 然後開始定期輪詢

**2. 定期輪詢**:
- 每 1.5 秒查詢一次進度
- 直到狀態變為 `succeeded` 或 `failed`

**3. 停止輪詢**:
- 當狀態為 `succeeded` 時，停止輪詢並跳轉到結果頁面
- 當狀態為 `failed` 時，停止輪詢並顯示錯誤訊息

### 輪詢實現範例

**JavaScript 範例**:

```javascript
async function pollProgress(jobId) {
  const pollInterval = 1500 // 1.5 秒
  
  // 立即查詢一次
  await checkProgress(jobId)
  
  // 開始定期輪詢
  const interval = setInterval(async () => {
    const shouldContinue = await checkProgress(jobId)
    
    if (!shouldContinue) {
      clearInterval(interval)
    }
  }, pollInterval)
  
  return () => clearInterval(interval)
}

async function checkProgress(jobId) {
  try {
    const response = await fetch(`/api/progress/${jobId}`)
    const data = await response.json()
    
    // 更新 UI
    updateProgressUI(data)
    
    // 檢查是否完成
    if (data.status === 'succeeded') {
      // 跳轉到結果頁面
      router.push(`/results/${jobId}`)
      return false // 停止輪詢
    }
    
    if (data.status === 'failed') {
      // 顯示錯誤訊息
      showError(data.message)
      return false // 停止輪詢
    }
    
    return true // 繼續輪詢
  } catch (error) {
    console.error('Error polling progress:', error)
    return true // 繼續輪詢（即使出錯）
  }
}
```

### 輪詢最佳實踐

**1. 指數退避（可選）**:
- 如果連續多次失敗，可以增加輪詢間隔
- 例如：1.5s → 3s → 6s

**2. 超時處理**:
- 設置最大輪詢時間（如 5 分鐘）
- 超過超時時間後停止輪詢並提示用戶

**3. 錯誤處理**:
- 網絡錯誤時繼續輪詢（不停止）
- 僅在明確的錯誤狀態（如 404）時停止輪詢

**4. 取消輪詢**:
- 用戶離開頁面時取消輪詢
- 使用 `AbortController` 或清理 `setInterval`

## 📊 完整流程範例

### 流程 1: 成功流程

```
1. POST /api/generate
   → 200 OK { "jobId": "job_123" }

2. GET /api/progress/job_123 (立即)
   → 200 OK { "status": "queued", "progress": 0 }

3. GET /api/progress/job_123 (1.5s 後)
   → 200 OK { "status": "running", "progress": 30 }

4. GET /api/progress/job_123 (1.5s 後)
   → 200 OK { "status": "running", "progress": 60 }

5. GET /api/progress/job_123 (1.5s 後)
   → 200 OK { "status": "succeeded", "progress": 100 }

6. GET /api/results/job_123
   → 200 OK { "jobId": "job_123", "images": [...], "paymentStatus": "unpaid" }
```

### 流程 2: 失敗流程

```
1. POST /api/generate
   → 200 OK { "jobId": "job_123" }

2. GET /api/progress/job_123 (立即)
   → 200 OK { "status": "queued", "progress": 0 }

3. GET /api/progress/job_123 (1.5s 後)
   → 200 OK { "status": "running", "progress": 30 }

4. GET /api/progress/job_123 (1.5s 後)
   → 200 OK { "status": "failed", "progress": 0, "error": "E_PROCESSING_FAILED" }
```

### 流程 3: 錯誤處理

```
1. POST /api/generate
   → 400 Bad Request { "error": "E_MISSING_FILES" }

2. GET /api/progress/invalid_id
   → 404 Not Found { "error": "E_JOB_NOT_FOUND" }

3. GET /api/results/job_123 (任務仍在處理中)
   → 404 Not Found { "error": "E_RESULTS_NOT_READY" }
```

## 📋 請求/響應範例

### Generate 端點

**請求範例**:
```bash
curl -X POST "https://family-mosaic-maker.vercel.app/api/generate" \
  -H "Authorization: Bearer <token>" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "style=vintage" \
  -F "template=mosaic"
```

**成功響應**:
```json
{
  "jobId": "job_1234567890_abc123"
}
```

**錯誤響應**:
```json
{
  "error": "E_MISSING_FILES",
  "message": "No files provided"
}
```

### Progress 端點

**請求範例**:
```bash
curl -X GET "https://family-mosaic-maker.vercel.app/api/progress/job_1234567890_abc123" \
  -H "Authorization: Bearer <token>"
```

**成功響應（處理中）**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "running",
  "progress": 45,
  "message": "Processing your images..."
}
```

**成功響應（完成）**:
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "succeeded",
  "progress": 100,
  "message": "Generation complete!"
}
```

**錯誤響應**:
```json
{
  "error": "E_JOB_NOT_FOUND",
  "message": "Job not found"
}
```

### Results 端點

**請求範例**:
```bash
curl -X GET "https://family-mosaic-maker.vercel.app/api/results/job_1234567890_abc123" \
  -H "Authorization: Bearer <token>"
```

**成功響應**:
```json
{
  "jobId": "job_1234567890_abc123",
  "images": [
    {
      "id": 0,
      "url": "https://storage.supabase.co/.../result1.jpg",
      "thumbnail": "https://storage.supabase.co/.../result1_thumb.jpg"
    }
  ],
  "paymentStatus": "unpaid",
  "createdAt": "2025-11-09T13:53:46.123Z"
}
```

**錯誤響應**:
```json
{
  "error": "E_RESULTS_NOT_READY",
  "message": "Results not ready yet"
}
```

## 🔍 狀態機詳細說明

### 狀態轉換規則

**1. `queued` → `running`**:
- 觸發條件: 任務開始處理
- 時間: 通常在創建後幾秒內

**2. `running` → `succeeded`**:
- 觸發條件: 任務成功完成
- 時間: 根據任務複雜度，通常 30 秒到 5 分鐘

**3. `running` → `failed`**:
- 觸發條件: 任務處理失敗
- 時間: 可能在處理過程中的任何時候

**4. `queued` → `failed`**:
- 觸發條件: 任務無法啟動（如資源不足）
- 時間: 通常在創建後幾秒內

### 狀態持久化

**數據庫存儲**:
- 狀態存儲在 `jobs` 表的 `status` 字段
- 進度存儲在 `jobs` 表的 `progress` 字段（0-100）
- 錯誤訊息存儲在 `jobs` 表的 `error_message` 字段

**狀態查詢**:
- 通過 `/api/progress/[id]` 查詢當前狀態
- 狀態實時更新，無需緩存

## 📚 相關文檔

- [最小資料庫架構](../db/min-schema.md)
- [RLS 基準策略](../db/rls-policy.md)
- [Magic Link E2E 測試說明](../tests/magic-link-e2e.md)

## 🔧 工具和命令

### 測試腳本

```bash
#!/bin/bash
# API 契約測試腳本

BASE_URL="${BASE_URL:-https://family-mosaic-maker.vercel.app}"
TOKEN="${TOKEN:-<your-token>}"

# 1. 創建任務
echo "1. Creating job..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "files=@test.jpg" \
  -F "style=vintage" \
  -F "template=mosaic")

JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
echo "Job ID: $JOB_ID"

# 2. 輪詢進度（每 1.5 秒）
echo "2. Polling progress..."
while true; do
  PROGRESS=$(curl -s -X GET "${BASE_URL}/api/progress/${JOB_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  
  STATUS=$(echo "$PROGRESS" | jq -r '.status')
  PROGRESS_PCT=$(echo "$PROGRESS" | jq -r '.progress')
  
  echo "Status: $STATUS, Progress: $PROGRESS_PCT%"
  
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 1.5
done

# 3. 獲取結果
echo "3. Fetching results..."
RESULTS=$(curl -s -X GET "${BASE_URL}/api/results/${JOB_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$RESULTS" | jq '.'
```

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義三個端點的 API 契約




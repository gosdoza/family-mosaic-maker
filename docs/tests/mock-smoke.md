# Mock 煙囪測試

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档描述 Mock 模式的烟囱测试流程，包括三个核心 API 端点的测试命令和期望结果。

## 📋 目錄

- [測試概述](#測試概述)
- [測試流程](#測試流程)
- [測試命令](#測試命令)
- [期望結果](#期望結果)
- [測試腳本](#測試腳本)

## 🧪 測試概述

### 測試目的

驗證 Mock 模式下三個核心 API 端點的基本功能：
1. **POST `/api/generate`** - 創建生成任務
2. **GET `/api/progress/[id]`** - 查詢任務進度（輪詢 2~3 次）
3. **GET `/api/results/[id]`** - 獲取生成結果

### 測試環境

**環境要求**:
- `NEXT_PUBLIC_USE_MOCK=true`（Mock 模式）
- Preview 或 Production 部署
- 無需登入（Mock 模式跳過認證）

### 測試前提

- Mock 模式已啟用
- API 端點可訪問
- 網絡連接正常

## 🔄 測試流程

### 完整流程

```
1. POST /api/generate
   ↓
2. GET /api/progress/:id (立即)
   ↓
3. GET /api/progress/:id (1.5s 後)
   ↓
4. GET /api/progress/:id (1.5s 後)
   ↓
5. GET /api/results/:id
```

### 流程說明

1. **創建任務**: 發送 POST 請求創建生成任務，獲取 `jobId`
2. **輪詢進度**: 使用獲取的 `jobId` 查詢任務進度（輪詢 2~3 次）
3. **獲取結果**: 查詢生成結果，驗證圖片列表和支付狀態

## 📝 測試命令

### 1. POST `/api/generate` - 創建生成任務

**測試命令**:

```bash
curl -i -X POST "https://family-mosaic-maker-abc123.vercel.app/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"],"style":"vintage","template":"mosaic"}'
```

**或使用 FormData**:

```bash
curl -i -X POST "https://family-mosaic-maker-abc123.vercel.app/api/generate" \
  -F "files=@a.jpg" \
  -F "files=@b.jpg" \
  -F "style=vintage" \
  -F "template=mosaic"
```

**驗收命令**:

```bash
curl -i -X POST "<preview>/api/generate" -d '{"files":["a.jpg","b.jpg"]}'
```

**期望響應** (200 OK):

```json
{
  "jobId": "demo-001"
}
```

**期望狀態碼**: `HTTP/2 200 OK`

**響應時間**: < 500ms（Mock 模式立即返回）

### 2. GET `/api/progress/[id]` - 查詢任務進度（輪詢）

**測試命令**:

```bash
# 第一次查詢（立即）
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"

# 等待 1.5 秒後第二次查詢
sleep 1.5
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"

# 等待 1.5 秒後第三次查詢
sleep 1.5
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"
```

**驗收命令**:

```bash
curl -i "<preview>/api/progress/demo-001"
```

**期望響應** (200 OK):

```json
{
  "jobId": "demo-001",
  "status": "succeeded",
  "progress": 100,
  "message": "Generation complete!"
}
```

**期望狀態碼**: `HTTP/2 200 OK`

**響應時間**: < 300ms（Mock 模式立即返回）

**輪詢次數**: 2~3 次

**輪詢間隔**: 1.5 秒（1500ms）

### 3. GET `/api/results/[id]` - 獲取生成結果

**測試命令**:

```bash
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results/demo-001"
```

**驗收命令**:

```bash
curl -i "<preview>/api/results/demo-001"
```

**期望響應** (200 OK):

```json
{
  "jobId": "demo-001",
  "images": [
    {
      "id": 0,
      "url": "/assets/mock/family1.jpg",
      "thumbnail": "/assets/mock/family1.jpg"
    },
    {
      "id": 1,
      "url": "/assets/mock/family2.jpg",
      "thumbnail": "/assets/mock/family2.jpg"
    }
  ],
  "paymentStatus": "unpaid",
  "createdAt": "2025-11-09T13:53:46.123Z"
}
```

**期望狀態碼**: `HTTP/2 200 OK`

**響應時間**: < 300ms（Mock 模式立即返回）

## ✅ 期望結果

### 期望狀態碼

| 端點 | 方法 | 期望狀態碼 | 說明 |
|------|------|-----------|------|
| `/api/generate` | POST | `200 OK` | 成功創建任務 |
| `/api/progress/[id]` | GET | `200 OK` | 成功查詢進度 |
| `/api/results/[id]` | GET | `200 OK` | 成功獲取結果 |

### 期望延時

| 端點 | 期望延時 | 說明 |
|------|---------|------|
| `/api/generate` | < 500ms | Mock 模式立即返回 |
| `/api/progress/[id]` | < 300ms | Mock 模式立即返回 |
| `/api/results/[id]` | < 300ms | Mock 模式立即返回 |

### 期望響應格式

**1. Generate 響應**:
- ✅ 包含 `jobId` 字段
- ✅ `jobId` 為字符串（如 `"demo-001"`）
- ✅ 狀態碼為 `200 OK`

**2. Progress 響應**:
- ✅ 包含 `jobId`, `status`, `progress`, `message` 字段
- ✅ `status` 為 `"succeeded"`（Mock 模式）
- ✅ `progress` 為 `100`（Mock 模式）
- ✅ 狀態碼為 `200 OK`

**3. Results 響應**:
- ✅ 包含 `jobId`, `images`, `paymentStatus`, `createdAt` 字段
- ✅ `images` 為數組，包含至少一個圖片對象
- ✅ 每個圖片對象包含 `id`, `url`, `thumbnail` 字段
- ✅ `paymentStatus` 為 `"unpaid"` 或 `"paid"`
- ✅ 狀態碼為 `200 OK`

## 📋 測試腳本

### 完整測試腳本

```bash
#!/bin/bash
# Mock 煙囪測試腳本

set -e

# 設置測試環境變數
PREVIEW_URL="${PREVIEW_URL:-https://family-mosaic-maker-abc123.vercel.app}"
POLL_INTERVAL=1.5  # 輪詢間隔（秒）
POLL_COUNT=3       # 輪詢次數

echo "🧪 Mock 煙囪測試"
echo "Preview URL: $PREVIEW_URL"
echo ""

# 步驟 1: 創建生成任務
echo "1️⃣  POST /api/generate"
echo "   創建生成任務..."
RESPONSE=$(curl -s -X POST "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"],"style":"vintage","template":"mosaic"}')

# 檢查響應狀態碼
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"],"style":"vintage","template":"mosaic"}')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ 失敗: HTTP $HTTP_CODE (期望 200)"
  exit 1
fi

# 提取 jobId
JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // "demo-001"')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "❌ 失敗: 無法獲取 jobId"
  exit 1
fi

echo "✅ 成功: jobId = $JOB_ID"
echo "   響應: $RESPONSE"
echo ""

# 步驟 2: 輪詢進度（2~3 次）
echo "2️⃣  GET /api/progress/$JOB_ID"
echo "   輪詢任務進度（$POLL_COUNT 次，間隔 ${POLL_INTERVAL}s）..."

for i in $(seq 1 $POLL_COUNT); do
  echo "   輪詢 #$i..."
  
  PROGRESS_RESPONSE=$(curl -s "${PREVIEW_URL}/api/progress/${JOB_ID}")
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${PREVIEW_URL}/api/progress/${JOB_ID}")
  
  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ 失敗: HTTP $HTTP_CODE (期望 200)"
    exit 1
  fi
  
  STATUS=$(echo "$PROGRESS_RESPONSE" | jq -r '.status // "unknown"')
  PROGRESS=$(echo "$PROGRESS_RESPONSE" | jq -r '.progress // 0')
  
  echo "   ✅ 成功: status = $STATUS, progress = $PROGRESS%"
  echo "   響應: $PROGRESS_RESPONSE"
  
  # 如果不是最後一次輪詢，等待間隔時間
  if [ $i -lt $POLL_COUNT ]; then
    sleep $POLL_INTERVAL
  fi
done

echo ""

# 步驟 3: 獲取生成結果
echo "3️⃣  GET /api/results/$JOB_ID"
echo "   獲取生成結果..."

RESULTS_RESPONSE=$(curl -s "${PREVIEW_URL}/api/results/${JOB_ID}")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${PREVIEW_URL}/api/results/${JOB_ID}")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ 失敗: HTTP $HTTP_CODE (期望 200)"
  exit 1
fi

IMAGES_COUNT=$(echo "$RESULTS_RESPONSE" | jq -r '.images | length // 0')
PAYMENT_STATUS=$(echo "$RESULTS_RESPONSE" | jq -r '.paymentStatus // "unknown"')

if [ "$IMAGES_COUNT" -eq 0 ]; then
  echo "❌ 失敗: 圖片列表為空"
  exit 1
fi

echo "✅ 成功: images = $IMAGES_COUNT, paymentStatus = $PAYMENT_STATUS"
echo "   響應: $RESULTS_RESPONSE"
echo ""

# 測試總結
echo "============ 測試總結 ============"
echo "✅ 所有測試通過"
echo "   - POST /api/generate: HTTP 200"
echo "   - GET /api/progress/$JOB_ID: HTTP 200 (輪詢 $POLL_COUNT 次)"
echo "   - GET /api/results/$JOB_ID: HTTP 200"
echo "================================="
```

### 簡化測試腳本（僅驗收命令）

```bash
#!/bin/bash
# Mock 煙囪測試（簡化版）

PREVIEW_URL="${PREVIEW_URL:-https://family-mosaic-maker-abc123.vercel.app}"

echo "🧪 Mock 煙囪測試（簡化版）"
echo ""

# 1. POST /api/generate
echo "1. POST /api/generate"
curl -i -X POST "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"]}'
echo ""

# 2. GET /api/progress/demo-001
echo "2. GET /api/progress/demo-001"
curl -i "${PREVIEW_URL}/api/progress/demo-001"
echo ""

# 3. GET /api/results/demo-001
echo "3. GET /api/results/demo-001"
curl -i "${PREVIEW_URL}/api/results/demo-001"
echo ""
```

## 📊 測試矩陣

### 測試場景

| 場景 | 端點 | 期望狀態碼 | 期望延時 | 驗證點 |
|------|------|-----------|---------|--------|
| 創建任務 | POST `/api/generate` | `200` | < 500ms | `jobId` 存在 |
| 查詢進度（第 1 次） | GET `/api/progress/:id` | `200` | < 300ms | `status` = `"succeeded"` |
| 查詢進度（第 2 次） | GET `/api/progress/:id` | `200` | < 300ms | `status` = `"succeeded"` |
| 查詢進度（第 3 次） | GET `/api/progress/:id` | `200` | < 300ms | `status` = `"succeeded"` |
| 獲取結果 | GET `/api/results/:id` | `200` | < 300ms | `images` 數組非空 |

### 測試檢查清單

- [ ] POST `/api/generate` 返回 `200 OK`
- [ ] 響應包含 `jobId` 字段
- [ ] GET `/api/progress/:id` 返回 `200 OK`（第 1 次）
- [ ] 響應包含 `status`, `progress`, `message` 字段
- [ ] `status` 為 `"succeeded"`（Mock 模式）
- [ ] `progress` 為 `100`（Mock 模式）
- [ ] GET `/api/progress/:id` 返回 `200 OK`（第 2 次）
- [ ] GET `/api/progress/:id` 返回 `200 OK`（第 3 次）
- [ ] GET `/api/results/:id` 返回 `200 OK`
- [ ] 響應包含 `images` 數組
- [ ] `images` 數組包含至少一個圖片對象
- [ ] 每個圖片對象包含 `id`, `url`, `thumbnail` 字段
- [ ] 響應包含 `paymentStatus` 字段

## 🔍 測試驗證

### 驗證步驟

#### 1. 驗證 Generate 端點

```bash
# 測試命令
curl -i -X POST "https://family-mosaic-maker-abc123.vercel.app/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"]}'

# 驗證點
# - HTTP 狀態碼: 200
# - 響應包含 jobId 字段
# - jobId 為字符串（如 "demo-001"）
```

#### 2. 驗證 Progress 端點（輪詢）

```bash
# 第一次查詢
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"

# 等待 1.5 秒
sleep 1.5

# 第二次查詢
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"

# 等待 1.5 秒
sleep 1.5

# 第三次查詢
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/progress/demo-001"

# 驗證點
# - HTTP 狀態碼: 200（每次）
# - 響應包含 status, progress, message 字段
# - status 為 "succeeded"（Mock 模式）
# - progress 為 100（Mock 模式）
```

#### 3. 驗證 Results 端點

```bash
# 測試命令
curl -i "https://family-mosaic-maker-abc123.vercel.app/api/results/demo-001"

# 驗證點
# - HTTP 狀態碼: 200
# - 響應包含 images 數組
# - images 數組包含至少一個圖片對象
# - 每個圖片對象包含 id, url, thumbnail 字段
# - 響應包含 paymentStatus 字段
```

## ⏱️ 延時說明

### 期望延時

**Mock 模式特性**:
- 所有端點立即返回（無實際處理時間）
- 無需等待實際任務處理
- 響應時間主要取決於網絡延遲

**延時範圍**:
- **Generate**: < 500ms（創建任務，無實際處理）
- **Progress**: < 300ms（查詢進度，無實際處理）
- **Results**: < 300ms（獲取結果，無實際處理）

### 輪詢延時

**輪詢間隔**: 1.5 秒（1500ms）

**輪詢次數**: 2~3 次

**總輪詢時間**: 約 3~4.5 秒（2~3 次 × 1.5 秒）

**注意事項**:
- Mock 模式下，每次查詢都立即返回 `succeeded` 狀態
- 實際生產環境中，需要等待任務處理完成
- 輪詢間隔應根據實際處理時間調整

## 📋 驗收命令

### 驗收命令列表

```bash
# 1. 創建生成任務
curl -i -X POST "<preview>/api/generate" -d '{"files":["a.jpg","b.jpg"]}'

# 2. 查詢任務進度
curl -i "<preview>/api/progress/demo-001"

# 3. 獲取生成結果
curl -i "<preview>/api/results/demo-001"
```

### 驗收命令說明

**1. POST `/api/generate`**:
- **方法**: POST
- **路徑**: `/api/generate`
- **Content-Type**: `application/json`
- **Body**: `{"files":["a.jpg","b.jpg"]}`
- **期望**: HTTP 200, 返回 `{"jobId": "demo-001"}`

**2. GET `/api/progress/demo-001`**:
- **方法**: GET
- **路徑**: `/api/progress/demo-001`
- **期望**: HTTP 200, 返回 `{"jobId": "demo-001", "status": "succeeded", "progress": 100, "message": "Generation complete!"}`

**3. GET `/api/results/demo-001`**:
- **方法**: GET
- **路徑**: `/api/results/demo-001`
- **期望**: HTTP 200, 返回 `{"jobId": "demo-001", "images": [...], "paymentStatus": "unpaid", "createdAt": "..."}`

## 🔧 測試工具

### 使用 jq 解析 JSON

```bash
# 安裝 jq（如果未安裝）
# macOS: brew install jq
# Linux: apt-get install jq

# 解析響應
curl -s "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"]}' | jq '.jobId'

# 提取字段
JOB_ID=$(curl -s "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"]}' | jq -r '.jobId')
```

### 使用時間戳測試延時

```bash
# 測試延時
START_TIME=$(date +%s%N)
curl -s "${PREVIEW_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"files":["a.jpg","b.jpg"]}' > /dev/null
END_TIME=$(date +%s%N)

ELAPSED=$((($END_TIME - $START_TIME) / 1000000))
echo "延時: ${ELAPSED}ms"
```

## 📚 相關文檔

- [API 契約](./generate-contract.md)
- [Magic Link E2E 測試說明](./magic-link-e2e.md)
- [Auth Redirect 測試說明](./auth-redirect.md)

## 🔍 故障排除

### 問題: 返回 401/403

**可能原因**:
1. Mock 模式未啟用
2. 認證檢查未跳過

**解決方法**:
1. 檢查環境變數 `NEXT_PUBLIC_USE_MOCK=true`
2. 確認 Preview 環境變數設置正確

### 問題: 返回 404

**可能原因**:
1. 端點路徑錯誤
2. 部署未包含 API 路由

**解決方法**:
1. 檢查端點路徑是否正確
2. 確認部署包含 API 路由

### 問題: 響應時間過長

**可能原因**:
1. 網絡延遲
2. 服務器響應慢

**解決方法**:
1. 檢查網絡連接
2. 確認服務器狀態正常

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 Mock 煙囪測試流程




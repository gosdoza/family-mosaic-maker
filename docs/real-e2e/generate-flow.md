# Real Generate Flow 規格文件

**版本**: v1.0.0  
**最後更新**: 2025-01-XX  
**狀態**: 設計階段

## 1️⃣ Overview

### 什麼是 Real Generate Flow？

Real Generate Flow 是將「生成流程」從 Mock 模式切換為真實模型（Runware 優先）的實作方案。它與現有的 Mock Generate Flow 並存，通過環境變數切換，確保：

- ✅ **Mock 模式完全保留**：`NEXT_PUBLIC_USE_MOCK=true` 時，行為與現有實作 100% 一致
- ✅ **Real 模式無縫切換**：`GENERATION_PROVIDER=runware` 時，使用真實 Runware API 生成圖片
- ✅ **前端 UI 兼容**：無論 Mock 或 Real，前端代碼無需修改

### 與 Mock 的關係

| 特性 | Mock 模式 | Real 模式 |
|------|----------|----------|
| 環境變數 | `NEXT_PUBLIC_USE_MOCK=true` | `GENERATION_PROVIDER=runware` |
| 圖片生成 | 內存狀態機模擬（90 秒） | Runware API 真實生成 |
| 圖片來源 | 本地 `/assets/mock/` 或占位符 | Runware 返回的實際圖片 URL |
| 狀態查詢 | 內存 `mockJobStore` | Supabase `jobs` 表 + Runware API |
| demo-001 | 特殊處理（直接返回完成） | 正常處理（需要真實 jobId） |
| 適用場景 | 開發、測試、E2E | Production、真實用戶 |

---

## 2️⃣ Provider Switch 設計

### 環境變數

**優先級順序**：
1. `GENERATION_PROVIDER`（新增）：`"mock"` | `"runware"` | `"fal"`（未來）
2. `NEXT_PUBLIC_USE_MOCK`（現有，向後兼容）：`"true"` → 等同於 `GENERATION_PROVIDER=mock`

**Fallback 策略**：
- 如果 `GENERATION_PROVIDER` 未設定，檢查 `NEXT_PUBLIC_USE_MOCK`
- 如果兩者都未設定，預設為 `"mock"`（保持現有行為）

### Provider 行為概述

#### `GENERATION_PROVIDER=mock`
- 完全使用現有 Mock 實作
- 不呼叫任何外部 API
- 使用內存狀態機模擬進度
- 返回 Mock 圖片 URL
- **行為與現有實作 100% 一致**

#### `GENERATION_PROVIDER=runware`
- 使用 Runware API 生成圖片
- 需要 `RUNWARE_API_KEY` 環境變數
- Job 狀態存儲在 Supabase `jobs` 表
- 圖片 URL 來自 Runware API 回應
- 支援進度查詢（通過 Runware API 或資料庫）

#### `GENERATION_PROVIDER=fal`（未來）
- 使用 FAL API 生成圖片
- 需要 `FAL_API_KEY` 環境變數
- 類似 Runware 的實作模式

---

## 3️⃣ API 契約（沿用現有規範）

### POST /api/generate

**請求格式**：與現有規範一致（FormData 或 JSON）

**成功響應**（200 OK）：
```json
{
  "ok": true,
  "jobId": "job_1234567890_abc123",
  "request_id": "req_..."
}
```

**Provider 差異**：
- **Mock**：jobId 格式為 `job_${timestamp}_${random}`，不存資料庫
- **Runware**：jobId 來自 Runware API 回應，存儲在 `jobs` 表

### GET /api/progress/:id

**成功響應**（200 OK）：
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "queued" | "running" | "succeeded" | "failed",
  "progress": 0-100,
  "message": "Processing your images..."
}
```

**Provider 差異**：
- **Mock**：
  - `demo-001` 直接返回 `succeeded`（特殊處理）
  - 其他 jobId 使用內存狀態機模擬（90 秒完成）
- **Runware**：
  - 查詢 Supabase `jobs` 表獲取狀態
  - 可選：呼叫 Runware API 獲取最新狀態（如果需要）

### GET /api/results/:id

**成功響應**（200 OK）：
```json
{
  "jobId": "job_1234567890_abc123",
  "images": [
    {
      "id": 0,
      "url": "https://...",
      "thumbnail": "https://..."
    }
  ],
  "paymentStatus": "paid" | "unpaid",
  "createdAt": "2025-01-XX...",
  "qualityScores": {...},
  "voucherIssued": false
}
```

**Provider 差異**：
- **Mock**：
  - 圖片來自 `generateMockPreviewUrls(3)`
  - 支援 `paid=1` query 參數（demo-001 測試用）
- **Runware**：
  - 圖片來自 Supabase `job_images` 表（從 Runware API 獲取後存儲）
  - 支付狀態從 `orders` 表查詢

---

## 4️⃣ Runware 實作要點

### 檔案結構

```
lib/generation/
├── providers/
│   ├── base.ts          # Provider 基礎介面
│   ├── mock.ts          # Mock provider（包裝現有實作）
│   └── runware.ts       # Runware provider（新增）
├── getProvider.ts       # Provider 工廠（新增）
└── ... (現有檔案)
```

### Runware Provider 介面

```typescript
interface GenerationProvider {
  generate(request: GenerateRequest): Promise<{ jobId: string }>
  getProgress(jobId: string): Promise<{ status: string, progress: number }>
  getResults(jobId: string): Promise<{ images: Image[] }>
}
```

### 實作細節

#### `generate()` 方法
- 呼叫 `lib/generation/runware-client.ts` 的 `callRunwareAPI()`
- 將回應的 jobId 存儲到 Supabase `jobs` 表（status: "pending"）
- 返回 `{ jobId }`

#### `getProgress()` 方法
- 查詢 Supabase `jobs` 表獲取當前狀態
- 可選：呼叫 Runware API 更新狀態（如果需要即時同步）
- 正規化狀態為 `{ status: "queued" | "running" | "succeeded" | "failed", progress: number }`

#### `getResults()` 方法
- 查詢 Supabase `job_images` 表獲取圖片列表
- 如果圖片尚未存儲，呼叫 Runware API 獲取並存儲
- 返回格式與 Mock 版一致：`{ images: [{ id, url, thumbnail }] }`

### 環境變數需求

- `RUNWARE_API_KEY`：必需（已存在）
- `RUNWARE_BASE_URL`：可選，預設 `https://api.runware.ai`（已存在）
- `RUNWARE_MODEL_ID`：可選，預設使用 Runware 預設模型

### 資料庫欄位

**`jobs` 表**（已存在）：
- `id`：jobId（來自 Runware API）
- `user_id`：用戶 ID
- `status`：`pending` | `processing` | `completed` | `failed`
- `progress`：0-100
- `created_at`：創建時間

**`job_images` 表**（已存在）：
- `id`：圖片 ID
- `job_id`：關聯的 jobId
- `url`：圖片 URL（來自 Runware）
- `thumbnail_url`：縮略圖 URL（可選）

---

## 5️⃣ Mock 共存策略

### 當 `GENERATION_PROVIDER=mock` 時

- ✅ 完全使用現有 Mock 實作
- ✅ `demo-001` 特殊處理保留
- ✅ 內存狀態機正常運作
- ✅ 不呼叫任何外部 API
- ✅ 行為與現有實作 100% 一致

### 當 `GENERATION_PROVIDER=runware` 時

- ✅ 使用 Runware API 生成圖片
- ✅ Job 存儲在資料庫
- ✅ 前端 UI 無需修改（API 回應格式一致）
- ⚠️ `demo-001` 不再有特殊處理（需要真實 jobId）
- ⚠️ 需要 `RUNWARE_API_KEY` 環境變數

### 切換方式

**Local 開發**：
```bash
# Mock 模式（預設）
NEXT_PUBLIC_USE_MOCK=true pnpm dev

# Real 模式
GENERATION_PROVIDER=runware RUNWARE_API_KEY=xxx pnpm dev
```

**Production**：
```bash
# 在 Vercel 環境變數中設定
GENERATION_PROVIDER=runware
RUNWARE_API_KEY=xxx
```

---

## 6️⃣ QA 腳本

### 新增 QA 腳本：`scripts/qa/real-generate-flow.mjs`

**功能**：
- 檢查 `/api/version` → 確認服務正常
- POST `/api/generate` → 在 `GENERATION_PROVIDER=runware` 下創建 job
- GET `/api/progress/:id` → 查詢進度（支援 timeout，最多 10 次，每次間隔 2 秒）
- GET `/api/results/:id` → 獲取結果（確認有圖片）

**執行方式**：

**Local（dev server 在 3000）**：
```bash
QA_BASE_URL="http://localhost:3000" \
GENERATION_PROVIDER=runware \
RUNWARE_API_KEY=xxx \
pnpm qa:real-generate-flow
```

**Production**：
```bash
QA_BASE_URL="https://family-mosaic-maker.vercel.app" \
GENERATION_PROVIDER=runware \
RUNWARE_API_KEY=xxx \
pnpm qa:real-generate-flow
```

**前置條件**：
- `GENERATION_PROVIDER=runware` 或未設定（會使用預設）
- `RUNWARE_API_KEY` 必須設定（否則腳本會失敗）
- 目標環境（BASE_URL）必須可訪問
- 注意：如果 API 需要認證，部分檢查可能會返回 401（這是預期的）

**注意事項**：
- 此腳本會實際呼叫 Runware API，會產生費用
- 如果沒有認證 token，`/api/generate` 會返回 401，這是正常的保護機制
- 進度查詢有 30 秒超時，如果 job 處理時間較長，可能會超時

---

## 7️⃣ 未來擴充

### 與 Pricing / Orders 串接

**目前狀態**：
- ✅ Generate Flow 已支援 Mock 與 Real 切換
- ⚠️ Pricing / Orders 仍使用 Mock（金流尚未接入真實 PayPal）

**未來擴充方向**：

#### 1. Real Pricing Flow
**檔案位置**：
- `app/api/checkout/route.ts` - 需要實作 PayPal provider
- `lib/paypal/` - 可能需要新增 PayPal provider 封裝
- `docs/real-e2e/pricing-flow.md` - 建立規格文件

**實作要點**：
- 接入真實 PayPal API（Sandbox 或 Production）
- 環境變數：`PAYMENT_PROVIDER=paypal`
- 保持與 Mock 模式的 API 回應格式一致

#### 2. Real Orders Flow
**檔案位置**：
- `app/api/orders/route.ts` - 已從 Supabase 查詢，可能需要調整
- `app/api/webhook/paypal/route.ts` - 需要實作真實 PayPal webhook 處理
- `docs/real-e2e/orders-flow.md` - 建立規格文件

**實作要點**：
- 從 Supabase `orders` 表查詢真實訂單（已部分實作）
- 與 PayPal webhook 整合，處理支付狀態更新
- 環境變數：沿用 `PAYMENT_PROVIDER`

#### 3. 完整 Real E2E Pipeline
**檔案位置**：
- `scripts/qa/real-e2e-all.mjs` - 建立總管腳本（類似 `mvp-mock-e2e-all.mjs`）
- `docs/real-e2e/README.md` - 建立 Real E2E 總覽文件

**實作要點**：
- 依序執行：Real Generate → Real Pricing → Real Orders
- 確保整個流程在真實環境下正常運作
- 在 `package.json` 新增 `qa:real-e2e-all` 指令

---

## 8️⃣ 相關文件

- [API 契約](../api/generate-contract.md)
- [Mock Generate Flow QA](../qa/mvp-generate-flow.md)
- [Runware Client 實作](../../lib/generation/runware-client.ts)
- [Provider Router 實作](../../lib/generation/provider-router.ts)

---

## 📝 更新日誌

- **v1.0.0** (2025-01-XX): 初始版本，定義 Real Generate Flow 規格


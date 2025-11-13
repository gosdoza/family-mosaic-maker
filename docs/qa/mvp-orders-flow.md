# MVP Orders Flow (Mock) 驗收指南

**版本**: v1.0.0  
**建立日期**: 2025-11-14  
**目標**: 提供完整的 Orders Flow（Mock 版）驗收步驟，確保 E2E 路徑可驗收

---

## 📋 Overview

本文件是「MVP Orders Flow（Mock 版）驗收規格」，定義在 `NEXT_PUBLIC_USE_MOCK=true` 前提下的 Orders Flow 行為。

**前置條件**：
- `NEXT_PUBLIC_USE_MOCK=true` 環境變數已設定
- 不需要實際資料庫或真實訂單資料
- 需要登入（`/orders` 頁面和 `/api/orders` API 都需要認證）

---

## 🔗 URL & 路由範圍

### `/orders` 頁面

**URL**: `/orders`

**認證要求**: ✅ **需要認證**（使用 `useAuth(true)`，未登入會自動 redirect 到 `/auth/login`）

**預期狀態碼**:
- 已登入：HTTP 200（正常顯示訂單列表）
- 未登入：HTTP 30x redirect 到 `/auth/login`（由 `useAuth` 處理）

**預期 UI**：
- ✅ 顯示 "Your Orders" 標題
- ✅ 顯示 Filter 按鈕（All、Completed、Processing）
- ✅ 顯示訂單列表（Card 格式）
- ✅ 每個訂單顯示：Order ID、日期、狀態 Badge、付費狀態 Badge、縮略圖、Template、圖片數量
- ✅ 每個訂單有 "View Results" 按鈕（連結到 `/results?id={jobId}`，若訂單為 paid 則加上 `&paid=1`）

---

### `/api/orders` API

**端點**: `GET /api/orders`

**認證要求**: ✅ **需要認證**（未登入會返回 401 Unauthorized）

**預期狀態碼**:
- 已登入：HTTP 200
- 未登入：HTTP 401 Unauthorized

**Mock 模式響應** (200 OK):
```json
{
  "orders": [
    {
      "id": "ORD-001",
      "date": "2025-11-14",
      "status": "Completed",
      "thumbnail": "/assets/mock/family1.jpg",
      "count": 3,
      "template": "Christmas",
      "jobId": "demo-001",
      "paymentStatus": "paid",
      "images": [
        { "id": 1, "url": "/assets/mock/family1.jpg", "thumbnail": "/assets/mock/family1.jpg" },
        { "id": 2, "url": "/assets/mock/family2.jpg", "thumbnail": "/assets/mock/family2.jpg" },
        { "id": 3, "url": "/assets/mock/family1.jpg", "thumbnail": "/assets/mock/family1.jpg" }
      ]
    }
  ]
}
```

---

### `/results?id=demo-001&paid=1` 與 Orders 的關係

**關係說明**：
- 從 `/orders` 頁面點擊 "View Results" 按鈕時：
  - 如果訂單的 `paymentStatus === "paid"`，應該導向 `/results?id={jobId}&paid=1`
  - 如果訂單的 `paymentStatus === "unpaid"`，應該導向 `/results?id={jobId}`（不含 paid 參數）

---

## 📦 Mock Orders 資料結構

### Order 介面定義

```typescript
interface Order {
  id: string                    // 訂單 ID（例如：ORD-001）
  date: string                  // 建立日期（ISO 8601 格式，例如：2025-11-14）
  status: string                // 訂單狀態（"Completed" | "Processing" | "Failed"）
  thumbnail: string             // 縮略圖 URL
  count: number                 // 圖片數量
  template: string              // 模板名稱（例如："Christmas"）
  style?: string                // 風格（可選）
  paymentStatus: "paid" | "unpaid"  // 付費狀態
  jobId?: string                // 關聯的 Job ID（例如："demo-001"）
  images?: Array<{              // 圖片列表（可選）
    id: number | string
    url: string
    thumbnail: string
  }>
}
```

### demo-001 特別要求

**必須存在**：Mock 模式下，`/api/orders` 必須返回至少一筆 `jobId === "demo-001"` 的訂單。

**狀態要求**：
- `status`: `"Completed"`
- `paymentStatus`: `"paid"`
- `jobId`: `"demo-001"`

**用途**：用於 QA 測試，確保 Orders Flow 可以完整驗收。

---

## 🚶 User Journey（文字版）

### 已登入使用者從 Dashboard 進入 Orders

1. **進入 Dashboard**：
   - 訪問 `/dashboard`
   - 看到 "Recent Orders" 卡片
   - 點擊 "View All" 按鈕

2. **進入 Orders 頁面**：
   - 自動導向到 `/orders`
   - 看到訂單列表（至少包含 demo-001）
   - 可以使用 Filter 按鈕篩選（All、Completed、Processing）

3. **查看訂單詳情**：
   - 點擊某筆訂單的 "View Results" 按鈕
   - 如果訂單為 `paid`，導向 `/results?id=demo-001&paid=1`
   - 如果訂單為 `unpaid`，導向 `/results?id=demo-001`

4. **從 Results 回到 Orders**：
   - 在 Results 頁面可能有導航連結回到 Orders
   - 或使用瀏覽器返回按鈕

---

### 已登入使用者從 Pricing Flow 進入 Orders

1. **完成 Pricing Flow**：
   - 訪問 `/pricing?job=demo-001`
   - 點擊 "Pay with PayPal"
   - 自動 redirect 到 `/results?id=demo-001&paid=1`

2. **查看 Orders**：
   - 從 Results 頁面或 Dashboard 進入 `/orders`
   - 應該看到 demo-001 的訂單，狀態為 `paid`

---

## ✅ 驗收 Checklist

### A. Orders 頁面基本功能

- [ ] `/orders` 在已登入時可正常開啟（HTTP 200）
- [ ] 頁面顯示 "Your Orders" 標題
- [ ] 頁面顯示 Filter 按鈕（All、Completed、Processing）
- [ ] 頁面顯示至少 1 筆 mock 訂單

### B. Orders API 資料結構

- [ ] `/api/orders` 回傳固定 schema，不因為是否有訂單數量變化而改欄位
- [ ] 回傳的 JSON 包含 `orders` 陣列
- [ ] 每個訂單包含必要欄位：`id`、`date`、`status`、`thumbnail`、`count`、`template`、`paymentStatus`、`jobId`

### C. demo-001 訂單存在性

- [ ] `demo-001` 訂單存在於 mock orders 中
- [ ] `demo-001` 訂單狀態為 `"Completed"`
- [ ] `demo-001` 訂單的 `paymentStatus` 為 `"paid"`

### D. Orders 頁面 UI 顯示

- [ ] 每個訂單顯示 Order ID
- [ ] 每個訂單顯示狀態 Badge（Completed / Processing）
- [ ] 每個訂單顯示付費狀態 Badge（Paid / Unpaid）
- [ ] 每個訂單顯示縮略圖
- [ ] 每個訂單顯示 Template 名稱
- [ ] 每個訂單顯示圖片數量

### E. View Results 連結

- [ ] 每個訂單有 "View Results" 按鈕或連結
- [ ] 如果訂單為 `paid`，連結指向 `/results?id={jobId}&paid=1`
- [ ] 如果訂單為 `unpaid`，連結指向 `/results?id={jobId}`（不含 paid 參數）

### F. 認證保護

- [ ] `/orders` 頁面未登入時會 redirect 到 `/auth/login`（30x）
- [ ] `/api/orders` 未登入時返回 401 Unauthorized

### G. Filter 功能

- [ ] Filter "All" 顯示所有訂單
- [ ] Filter "Completed" 只顯示狀態為 "Completed" 的訂單
- [ ] Filter "Processing" 只顯示狀態為 "Processing" 的訂單

### H. 空狀態處理

- [ ] 當沒有訂單時，顯示 "No orders yet" 或類似訊息
- [ ] 空狀態有 CTA 按鈕（例如："Create Your First Mosaic"）

---

## 🔧 測試工具

### 快速測試（使用 demo-001）

1. **測試 Orders 頁面**（需要登入）：
   ```
   https://family-mosaic-maker.vercel.app/orders
   ```

2. **測試 Orders API**（需要登入）：
   ```
   https://family-mosaic-maker.vercel.app/api/orders
   ```

3. **測試 View Results 連結**：
   ```
   https://family-mosaic-maker.vercel.app/results?id=demo-001&paid=1
   ```

---

## 📝 注意事項

1. **Mock 模式限制**：
   - 所有訂單都是 Mock 的，不會實際從資料庫讀取
   - 訂單資料是固定的，不會因為實際操作而改變
   - `demo-001` 訂單是專門為 QA 測試設計的

2. **認證要求**：
   - Orders 頁面和 API 都需要登入
   - UI 層級的完整流程需要在登入後測試
   - QA 腳本會明確標記認證保護為「預期行為」

3. **環境變數**：
   - 確保 `NEXT_PUBLIC_USE_MOCK=true` 已設定
   - 不需要設定資料庫連線或 Supabase Service Role Key

---

## 🐛 疑難排解

### 問題：Orders 頁面顯示 "Loading..." 一直轉圈

**可能原因**：
- 未登入（`useAuth` 正在處理 redirect）
- API 請求失敗

**解決方法**：
- 確認已登入
- 檢查瀏覽器 Console 是否有錯誤
- 檢查 Network 標籤，確認 `/api/orders` 的請求與回應

### 問題：Orders API 返回 401

**可能原因**：
- 未登入
- Session 過期

**解決方法**：
- 這是預期行為（API 需要認證）
- 在 UI 層級測試時，確保已登入

### 問題：看不到 demo-001 訂單

**可能原因**：
- Mock 模式未啟用
- API 回傳的資料格式不符合預期

**解決方法**：
- 確認 `NEXT_PUBLIC_USE_MOCK=true`
- 檢查 `/api/orders` 的回應，確認包含 `demo-001`

### 問題：View Results 連結沒有包含 paid=1

**可能原因**：
- 訂單的 `paymentStatus` 不是 `"paid"`
- UI 邏輯未正確處理 `paid` 狀態

**解決方法**：
- 確認訂單的 `paymentStatus` 為 `"paid"`
- 檢查 `/orders` 頁面的 "View Results" 連結邏輯

---

## 📚 相關文件

- [MVP Generate Flow](./mvp-generate-flow.md) - Generate Flow 驗收指南
- [MVP Pricing Flow](./mvp-pricing-flow.md) - Pricing Flow 驗收指南
- [MVP E2E Checklist](./mvp-e2e-checklist.md) - 整體 MVP 驗收清單

---

## 🔄 如何執行自動化 QA

執行以下命令：

```bash
pnpm qa:mvp-orders-flow
```

或使用自訂 base URL：

```bash
QA_BASE_URL="http://localhost:3000" pnpm qa:mvp-orders-flow
```

腳本會檢查：
- `/api/version` - 確認線上版本存在
- `/orders` - Orders 頁面是否正常載入
- `/api/orders` - Orders API 的認證保護與資料結構
- `/results?id=demo-001&paid=1` - Results 頁面（已付費狀態）

**注意**：腳本會明確標記認證保護為「預期行為」，不會因為 401 而失敗。

---

## 📋 最小化手動 QA

對於已登入的使用者，執行以下步驟：

### 步驟 1: 登入

1. 訪問 `/auth/login`
2. 輸入 email，請求 Magic Link
3. 點擊 Magic Link 完成登入
4. 確認被導向到 `/dashboard`

### 步驟 2: 從 Dashboard 進入 Orders

1. 在 Dashboard 的 "Recent Orders" 卡片中，點擊 "View All"
2. 確認自動導向到 `/orders`
3. 確認頁面正常載入，顯示訂單列表

### 步驟 3: 驗證 Orders 頁面

1. 確認顯示至少一筆訂單（包含 demo-001）
2. 確認 demo-001 訂單顯示：
   - Order ID: `ORD-001`
   - 狀態: `Completed`（綠色 Badge）
   - 付費狀態: `Paid`（綠色 Badge）
   - 縮略圖正常顯示
   - Template: `Christmas`
   - 圖片數量: `3 variations`

### 步驟 4: 測試 Filter

1. 點擊 "All" Filter，確認顯示所有訂單
2. 點擊 "Completed" Filter，確認只顯示 Completed 訂單
3. 點擊 "Processing" Filter，確認只顯示 Processing 訂單（如果有的話）

### 步驟 5: 測試 View Results 連結

1. 找到 demo-001 訂單（`paymentStatus: "paid"`）
2. 點擊 "View Results" 按鈕
3. 確認導向到 `/results?id=demo-001&paid=1`（URL 包含 `paid=1`）
4. 確認 Results 頁面顯示 "Paid ✅" badge

---

## 📝 更新日誌

- **v1.0.0** (2025-11-14): 初始版本，定義 MVP Orders Flow (Mock) 驗收規格


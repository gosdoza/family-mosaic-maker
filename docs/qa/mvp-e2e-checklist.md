# MVP Mock E2E 驗收檢查清單

**目標環境**: Production - https://family-mosaic-maker.vercel.app  
**測試日期**: 待填寫  
**測試人員**: 待填寫

---

## 0️⃣ Preflight

- [ ] **檢查 /api/version**
  - HTTP Status: 200
  - Response JSON: `{"ok": true, "commit": "...", "now": "..."}`
  - 確認 commit SHA 與最新部署一致

- [ ] **檢查 Landing page (/)**
  - HTTP Status: 200
  - 頁面標題包含 "Family Mosaic Maker" 或 "Turn Memories Into Family Moments"
  - 頁面正常渲染，無 JavaScript 錯誤

- [ ] **Supabase URL 配置**
  - 確認 Supabase Dashboard 中的 Site URL 設定為 `https://family-mosaic-maker.vercel.app`
  - 確認 Redirect URLs 包含：
    - `https://family-mosaic-maker.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`（開發用）
  - 確認環境變數 `NEXT_PUBLIC_SITE_URL` 在 Vercel 中設定為 `https://family-mosaic-maker.vercel.app`

---

## 1️⃣ 未登入狀態保護

- [ ] **未登入訪問 /dashboard**
  - HTTP Status: 30x (Redirect)
  - Location header 包含 `/auth/login`
  - 不會顯示 Dashboard 內容

- [ ] **未登入訪問 /orders（如果已實作）**
  - HTTP Status: 30x (Redirect) 或 200（如果允許未登入查看）
  - 不會返回 500 Internal Server Error

---

## 2️⃣ Magic Link 登入（人工步驟）

- [ ] **打開 /auth/login**
  - 頁面正常顯示
  - Email 輸入框可用
  - 「Send Magic Link」按鈕可用

- [ ] **輸入 email 並發送 Magic Link**
  - 點擊按鈕後顯示「已發送」提示
  - 收到 Supabase 寄來的 Magic Link 郵件

- [ ] **點擊 Magic Link**
  - 在同一瀏覽器中點擊郵件中的連結
  - 成功 redirect 到 `/dashboard`
  - **不會看到 JSON error**（例如 `{"error":"invalid request: both auth code and code verifier should be non-empty"}`）
  - 不會停留在 `/auth/callback` 顯示錯誤

---

## 3️⃣ Dashboard 2.0

- [ ] **URL 確認**
  - 當前 URL 為 `/dashboard`
  - 不會被 redirect 到其他頁面

- [ ] **頁面結構**
  - 有 3 個主要卡片區塊：
    1. **Next Step** 卡片（左側或上方）
    2. **Your Account** 卡片（右側或下方）
    3. **Recent Orders** 卡片（全寬，位於下方）

- [ ] **Next Step 卡片**
  - 顯示標題 "Next Step"
  - 有「Generate a new family mosaic」按鈕
  - 按鈕連結到 `/generate`

- [ ] **Your Account 卡片**
  - 顯示標題 "Your Account"
  - 顯示正確的 email（與登入時使用的 email 一致）
  - 顯示帳號類型 Badge（"Free User" 或 "Paid User"）
  - 如果是 Free User，顯示 "Upgrade" 按鈕（連結到 `/pricing`）

- [ ] **Recent Orders 卡片**
  - 顯示標題 "Recent Orders"
  - 顯示 3 筆 mock 訂單（或實際訂單，如果有）
  - 每筆訂單顯示：
    - 訂單 ID（例如 `#FM-2025-0001`）
    - 日期
    - 狀態 Badge（Completed / Processing 等）
    - "View" 按鈕
  - 有 "View All" 按鈕（連結到 `/orders`）

---

## 4️⃣ Mock API Flow

- [ ] **POST /api/generate**
  - HTTP Status: 200
  - Response JSON: `{"ok": true, "jobId": "job_xxx", "request_id": "req_xxx"}`
  - `jobId` 欄位存在且為字串

- [ ] **GET /api/progress/{jobId}**
  - 使用上一步取得的 `jobId`
  - HTTP Status: 200
  - Response JSON: `{"status": "succeeded", "progress": 100, ...}`
  - `status` 欄位存在且為字串
  - `progress` 欄位存在且為數字（0-100）

- [ ] **GET /api/results/{jobId}**
  - 使用相同的 `jobId`
  - HTTP Status: 200
  - Response JSON: `{"images": [...], ...}`
  - `images` 欄位存在且為陣列
  - `images` 陣列長度 ≥ 1

---

## 5️⃣ Results & Pricing & Paid Results

- [ ] **Results 頁面（未付費）**
  - URL: `/results?id={jobId}`
  - HTTP Status: 200
  - 頁面正常顯示
  - 顯示生成的圖片（或 placeholder）
  - 顯示付費提示或 CTA

- [ ] **Pricing 頁面**
  - URL: `/pricing`
  - HTTP Status: 200
  - 頁面包含 "PayPal" 或 "$2.99" 字樣
  - 顯示價格資訊
  - 有 PayPal 付款按鈕或 CTA

- [ ] **Results 頁面（已付費）**
  - URL: `/results?id={jobId}&paid=1`
  - HTTP Status: 200
  - 頁面進入「已付費」狀態
  - 顯示完整圖片（無水印或限制）
  - 顯示下載按鈕或相關功能

---

## 6️⃣ Orders Flow（Mock）

### 自動化 QA 腳本

執行以下命令進行自動化檢查：

```bash
pnpm qa:mvp-orders-flow
```

或使用自訂 base URL：

```bash
QA_BASE_URL="http://localhost:3000" pnpm qa:mvp-orders-flow
```

### 檢查項目

- [ ] **GET /api/version**
  - HTTP Status: 200
  - Response JSON: `{"ok": true, "commit": "...", "now": "..."}`
  - 確認 commit SHA 與最新部署一致

- [ ] **GET /orders**
  - 未登入：HTTP Status: 30x (Redirect to `/auth/login`)
  - 已登入：HTTP Status: 200
  - 頁面包含 "Orders" 或 "Your Orders" 關鍵字
  - 頁面正常顯示，不會 500

- [ ] **GET /api/orders**
  - 未登入：HTTP Status: 401 (Unauthorized) - 預期行為
  - 已登入：HTTP Status: 200
  - Response JSON: `{"orders": [...]}`
  - 返回的資料是陣列格式
  - 每個訂單包含必要欄位：`id`、`date`、`status`、`thumbnail`、`count`、`template`、`paymentStatus`、`jobId`
  - **必須包含 `demo-001` 訂單**，且 `paymentStatus: "paid"`、`status: "Completed"`

- [ ] **/orders 頁面 UI**
  - 顯示 "Your Orders" 標題
  - 顯示 Filter 按鈕（All、Completed、Processing）
  - 顯示訂單列表（Card 格式）
  - 每個訂單顯示：Order ID、日期、狀態 Badge、付費狀態 Badge、縮略圖、Template、圖片數量
  - 每個訂單有 "View Results" 按鈕

- [ ] **View Results 連結**
  - 如果訂單 `paymentStatus === "paid"`，連結指向 `/results?id={jobId}&paid=1`
  - 如果訂單 `paymentStatus === "unpaid"`，連結指向 `/results?id={jobId}`（不含 paid 參數）

- [ ] **GET /results?id=demo-001&paid=1**
  - HTTP Status: 200
  - 頁面包含 "Paid" 或 "Premium" 關鍵字（已付費狀態標記）

- [ ] **Dashboard Recent Orders → View All**
  - 從 Dashboard 點擊 "View All" 按鈕
  - 成功導航到 `/orders`
  - 不會 404 或 500

### 人工補充驗收建議

1. **登入後從 Dashboard 進入 Orders**：
   - 在 Dashboard 的 "Recent Orders" 卡片中，點擊 "View All"
   - 確認自動導向到 `/orders`
   - 確認頁面正常載入，顯示訂單列表

2. **測試 Filter 功能**：
   - 點擊 "All" Filter，確認顯示所有訂單
   - 點擊 "Completed" Filter，確認只顯示 Completed 訂單
   - 點擊 "Processing" Filter，確認只顯示 Processing 訂單（如果有的話）

3. **測試 View Results 連結**：
   - 找到 demo-001 訂單（`paymentStatus: "paid"`）
   - 點擊 "View Results" 按鈕
   - 確認導向到 `/results?id=demo-001&paid=1`（URL 包含 `paid=1`）
   - 確認 Results 頁面顯示 "Paid ✅" badge

### 相關文件

- [MVP Orders Flow 詳細規格](./mvp-orders-flow.md) - 完整的 Orders Flow 驗收指南

---

## 7️⃣ Auth 邊界情境（描述即可）

- [ ] **Magic link 被點第二次**
  - 行為：應該顯示「連結已使用」或 redirect 到 `/auth/error`
  - 不會導致 500 錯誤

- [ ] **Magic link 在不同裝置打開**
  - 行為：應該顯示 PKCE cookie 缺失錯誤，redirect 到 `/auth/error?reason=missing_pkce_cookie`
  - 錯誤訊息提示使用者使用同一瀏覽器

- [ ] **已登入使用者訪問 /auth/login**
  - 行為：應該 redirect 到 `/dashboard` 或顯示「已登入」狀態
  - 不會顯示登入表單（或顯示已登入提示）

---

## 驗收完成標準

當以下項目都通過時，可以宣告「MVP Mock E2E Flow 通過」：

- ✅ **0️⃣ Preflight**：所有項目通過
- ✅ **1️⃣ 未登入狀態保護**：所有項目通過
- ✅ **3️⃣ Dashboard 2.0**：所有項目通過
- ✅ **4️⃣ Mock API Flow**：所有項目通過
- ✅ **5️⃣ Results & Pricing & Paid Results**：所有項目通過
- ✅ **6️⃣ Orders**：如果已實作，所有項目通過；如果未實作（404），可忽略
- ⚠️ **2️⃣ Magic Link 登入**：在人工測試中看起來合理（能成功登入，不會看到 JSON error）
- ⚠️ **7️⃣ Auth 邊界情境**：在人工測試中看起來合理（錯誤處理正確，不會 500）

---

## 備註

- 此檢查清單主要針對 **Mock 模式**下的 E2E 流程
- 如果某些功能尚未實作（例如 Orders），請在對應項目標註「未實作」並跳過
- 所有 HTTP 狀態碼檢查允許 200-299 範圍（2xx 都算成功）
- 5xx 錯誤視為失敗，需要修復


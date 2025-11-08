# 🧭 部署前操作清單（Step by Step）

## ① 推送資料庫遷移

### 確保本地 Supabase CLI 已登入

```bash
# 檢查 Supabase CLI 是否已安裝
which supabase

# 如果未安裝，請先安裝
npm install -g supabase
# 或
brew install supabase/tap/supabase

# 登入 Supabase
supabase login

# 連結到你的專案
supabase link --project-ref <your-project-ref>

# 推送遷移
supabase db push
```

### ✅ 驗證項目

- ☑️ 將 `orders` 與 `webhook_events` 表推送到雲端
- ☑️ 自動套用索引與 RLS Policy（已在 migration 內建）

---

## ② 在 Supabase Dashboard 驗證資料表

### 登入 Supabase Dashboard

1. 前往 https://supabase.com/dashboard
2. 選擇你的專案
3. 進入 **SQL Editor**

### 執行驗證查詢

```sql
-- 檢查 orders 表
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- 檢查 webhook_events 表
SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 10;

-- 檢查表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'webhook_events';
```

### ✅ 確認項目

- ☑️ `orders` 表存在且結構正確
- ☑️ `webhook_events` 表存在且結構正確
- ☑️ 索引已創建（`idx_orders_job`, `idx_orders_status`, 等）
- ☑️ RLS Policy 已啟用

---

## ③ 本地 .env.local 調整

### 切換到生產模式

編輯 `.env.local`：

```bash
# 關閉 Mock 模式
USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=false

# PayPal 配置（Sandbox 或 Production）
PAYPAL_CLIENT_ID=你的ClientID
PAYPAL_SECRET=你的Secret
PAYPAL_WEBHOOK_ID=你的WebhookID

# Supabase 配置（保持不變）
NEXT_PUBLIC_SUPABASE_URL=你的SupabaseURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的SupabaseAnonKey
```

### ✅ 驗證項目

- ☑️ Mock 模式已關閉
- ☑️ PayPal 憑證已配置
- ☑️ Webhook ID 已設置

---

## ④ 真實金流 Sandbox 測試

### 在 PayPal Developer Dashboard 配置

1. 前往 https://developer.paypal.com/dashboard/applications
2. 登入你的 PayPal 開發者帳號

### 建立 Sandbox App

1. 點擊 **Create App**
2. 選擇 **Sandbox** 環境
3. 輸入 App 名稱（例如：`Family Mosaic Maker`）
4. 記錄 **Client ID** 和 **Secret**

### 配置 Webhook

1. 在 App 設定中找到 **Webhooks** 區塊
2. 點擊 **Add Webhook**
3. 輸入 Webhook URL：
   ```
   https://your-domain.com/api/webhook/paypal
   ```
   或本地測試：
   ```
   https://your-ngrok-url.ngrok.io/api/webhook/paypal
   ```
4. 訂閱以下事件：
   - ✅ `PAYMENT.CAPTURE.COMPLETED`
   - ✅ `CHECKOUT.ORDER.APPROVED`
   - ✅ `PAYMENT.CAPTURE.DENIED`（可選）
5. 記錄 **Webhook ID** 並填入 `.env.local`

### ✅ 驗證項目

- ☑️ Sandbox App 已創建
- ☑️ Client ID 和 Secret 已記錄
- ☑️ Webhook URL 已配置
- ☑️ 事件已訂閱
- ☑️ Webhook ID 已填入環境變數

---

## ⑤ 測試真實沙盒結帳

### 本地測試流程

1. **啟動開發伺服器**：
   ```bash
   pnpm dev
   ```

2. **打開瀏覽器**：
   ```
   http://localhost:3000/pricing
   ```

3. **執行測試**：
   - 點擊「Pay with PayPal - $2.99」
   - 使用 PayPal Sandbox 帳號登入
   - 完成支付流程
   - 確認自動跳轉到 `/results/:jobId`

4. **檢查 Console Log**：
   - 打開瀏覽器開發者工具
   - 查看 Console 是否顯示 webhook 收到事件
   - 查看 Network 標籤確認 API 調用

5. **檢查資料庫**：
   ```sql
   -- 檢查訂單狀態
   SELECT id, job_id, status, paypal_order_id, paypal_capture_id, created_at
   FROM orders
   ORDER BY created_at DESC
   LIMIT 5;

   -- 檢查 webhook 事件
   SELECT id, event_type, resource_id, received_at
   FROM webhook_events
   ORDER BY received_at DESC
   LIMIT 5;
   ```

### ✅ 驗證項目

- ☑️ 結帳流程正常運作
- ☑️ 自動跳轉到 results 頁面
- ☑️ Console 顯示 webhook 收到事件
- ☑️ 資料庫 `orders` 狀態從 `pending` → `paid`
- ☑️ `webhook_events` 有記錄對應 event id

---

## ⑥ 若部署到 Vercel

### 同步環境變數

1. 前往 https://vercel.com/dashboard
2. 選擇你的專案
3. 進入 **Settings** → **Environment Variables**

### 添加以下環境變數

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的SupabaseURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的SupabaseAnonKey

# Mock 模式（生產環境應為 false）
USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=false

# PayPal
PAYPAL_CLIENT_ID=你的ClientID
PAYPAL_SECRET=你的Secret
PAYPAL_WEBHOOK_ID=你的WebhookID

# 其他（如需要）
DOMAIN=https://your-domain.com
```

### 設定環境範圍

- **Production**: 所有環境變數
- **Preview**: 所有環境變數（可選）
- **Development**: 所有環境變數（可選）

### ✅ 驗證項目

- ☑️ 所有環境變數已添加
- ☑️ 環境範圍已正確設定
- ☑️ 敏感資訊（Secret）已標記為加密

---

## ⑦ 自動化驗收

### 運行測試套件

```bash
# 運行所有 E2E 測試
pnpm test:e2e

# 運行特定測試
pnpm test:e2e tests/paypal-checkout-flow.spec.ts
pnpm test:e2e tests/paypal-orders-status.spec.ts
pnpm test:e2e tests/webhook-idempotency.spec.ts
```

### ✅ 測試清單

- ☑️ `paypal-checkout-flow.spec.ts`（E2E 完整流程）
- ☑️ `paypal-orders-status.spec.ts`（API 狀態驗證）
- ☑️ `webhook-idempotency.spec.ts`（Webhook 冪等性）

### 預期結果

所有測試應顯示 **綠色通過**，代表：
- ✅ 整個金流與訂單鏈接閉環正常
- ✅ Mock 模式與生產模式切換正常
- ✅ Webhook 處理正常
- ✅ 訂單狀態更新正常

---

## 🚨 常見問題

### Q: Supabase CLI 未安裝

```bash
# 安裝 Supabase CLI
npm install -g supabase
# 或
brew install supabase/tap/supabase
```

### Q: 無法連結 Supabase 專案

```bash
# 檢查專案參考 ID
supabase projects list

# 手動連結
supabase link --project-ref <your-project-ref>
```

### Q: Webhook 無法接收事件

1. 確認 Webhook URL 可公開訪問（使用 ngrok 或部署到 Vercel）
2. 確認 PayPal Sandbox 中的 Webhook URL 正確
3. 檢查 Vercel 日誌或本地伺服器日誌

### Q: 訂單狀態未更新

1. 檢查 webhook 是否成功接收事件
2. 檢查資料庫 RLS Policy 是否正確
3. 檢查 `updateOrderPaidByJob` 函數是否正常執行

---

## 📝 檢查清單

在部署前，確認以下項目：

- [ ] 資料庫遷移已推送
- [ ] Supabase Dashboard 驗證通過
- [ ] `.env.local` 已調整為生產模式
- [ ] PayPal Sandbox 配置完成
- [ ] 真實沙盒結帳測試通過
- [ ] Vercel 環境變數已同步
- [ ] 所有自動化測試通過
- [ ] 生產環境 Webhook URL 已配置
- [ ] 監控和日誌已設置

---

**最後更新**: 2025-01-15
**狀態**: ✅ 準備就緒


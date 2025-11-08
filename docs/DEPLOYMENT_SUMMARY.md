# 🚀 部署前操作清單總結

## ✅ 已完成的工作

### 1. 文檔和腳本
- ✅ `docs/DEPLOYMENT_CHECKLIST.md`: 完整的部署前操作清單
- ✅ `scripts/deploy-check.sh`: 自動化部署檢查腳本
- ✅ `.env.local.example`: 更新環境變數範例

### 2. 資料庫遷移
- ✅ `supabase/migrations/20250115000000_add_orders.sql`: 已準備
- ✅ 包含 `orders` 和 `webhook_events` 表
- ✅ 包含索引和 RLS Policy

### 3. 測試文件
- ✅ `tests/paypal-checkout-flow.spec.ts`: E2E 完整流程測試
- ✅ `tests/paypal-orders-status.spec.ts`: API 狀態驗證測試
- ✅ `tests/webhook-idempotency.spec.ts`: Webhook 冪等性測試

---

## 📋 下一步操作清單

### ① 推送資料庫遷移

```bash
# 確保 Supabase CLI 已登入
supabase login

# 連結到你的專案（如果尚未連結）
supabase link --project-ref <your-project-ref>

# 推送遷移
supabase db push
```

**驗證**：
- ☑️ `orders` 表已創建
- ☑️ `webhook_events` 表已創建
- ☑️ 索引已創建
- ☑️ RLS Policy 已啟用

---

### ② 在 Supabase Dashboard 驗證資料表

1. 前往 https://supabase.com/dashboard
2. 選擇你的專案
3. 進入 **SQL Editor**
4. 執行驗證查詢：

```sql
-- 檢查 orders 表
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- 檢查 webhook_events 表
SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 10;

-- 檢查表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders';
```

**驗證**：
- ☑️ 表結構正確
- ☑️ 索引存在
- ☑️ RLS Policy 已啟用

---

### ③ 調整本地 .env.local

編輯 `.env.local`，切換到生產模式：

```bash
# 關閉 Mock 模式
USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=false

# PayPal 配置（Sandbox 或 Production）
PAYPAL_CLIENT_ID=你的ClientID
PAYPAL_SECRET=你的Secret
PAYPAL_WEBHOOK_ID=你的WebhookID
```

**驗證**：
- ☑️ Mock 模式已關閉
- ☑️ PayPal 憑證已配置
- ☑️ Webhook ID 已設置

---

### ④ 配置 PayPal Sandbox

1. 前往 https://developer.paypal.com/dashboard/applications
2. 創建 Sandbox App
3. 記錄 **Client ID** 和 **Secret**
4. 配置 Webhook：
   - URL: `https://your-domain.com/api/webhook/paypal`
   - 訂閱事件：
     - ✅ `PAYMENT.CAPTURE.COMPLETED`
     - ✅ `CHECKOUT.ORDER.APPROVED`
5. 記錄 **Webhook ID** 並填入 `.env.local`

**驗證**：
- ☑️ Sandbox App 已創建
- ☑️ Webhook URL 已配置
- ☑️ 事件已訂閱
- ☑️ Webhook ID 已填入環境變數

---

### ⑤ 測試真實沙盒結帳

1. 啟動開發伺服器：
   ```bash
   pnpm dev
   ```

2. 打開瀏覽器：
   ```
   http://localhost:3000/pricing
   ```

3. 執行測試：
   - 點擊「Pay with PayPal - $2.99」
   - 使用 PayPal Sandbox 帳號登入
   - 完成支付流程
   - 確認自動跳轉到 `/results/:jobId`

4. 檢查 Console Log：
   - 打開瀏覽器開發者工具
   - 查看 Console 是否顯示 webhook 收到事件
   - 查看 Network 標籤確認 API 調用

5. 檢查資料庫：
   ```sql
   SELECT id, job_id, status, paypal_order_id, paypal_capture_id, created_at
   FROM orders
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**驗證**：
- ☑️ 結帳流程正常運作
- ☑️ 自動跳轉到 results 頁面
- ☑️ Console 顯示 webhook 收到事件
- ☑️ 資料庫 `orders` 狀態從 `pending` → `paid`

---

### ⑥ 部署到 Vercel

1. 前往 https://vercel.com/dashboard
2. 選擇你的專案
3. 進入 **Settings** → **Environment Variables**
4. 添加以下環境變數：

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

# 其他
DOMAIN=https://your-domain.com
```

**驗證**：
- ☑️ 所有環境變數已添加
- ☑️ 環境範圍已正確設定
- ☑️ 敏感資訊（Secret）已標記為加密

---

### ⑦ 運行自動化測試

```bash
# 運行所有 E2E 測試
pnpm test:e2e

# 運行特定測試
pnpm test:e2e tests/paypal-checkout-flow.spec.ts
pnpm test:e2e tests/paypal-orders-status.spec.ts
pnpm test:e2e tests/webhook-idempotency.spec.ts
```

**預期結果**：
- ✅ 所有測試通過（綠色）
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

## 📝 最終檢查清單

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

## 🎯 完成標準

所有項目完成後，系統應：
- ✅ 支持真實 PayPal 結帳流程
- ✅ 正確處理 PayPal webhook 事件
- ✅ 正確更新訂單狀態
- ✅ 支持 webhook 事件 idempotency
- ✅ 所有測試通過

---

**最後更新**: 2025-01-15
**狀態**: ✅ 準備就緒


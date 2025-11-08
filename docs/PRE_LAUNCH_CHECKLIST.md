# 🚀 上線前最終檢查清單

## 1. 執行資料庫建置

### 選項 A: 使用 Supabase CLI

```bash
# 安裝 Supabase CLI (如果還沒安裝)
npm install -g supabase

# 登入 Supabase
supabase login

# 連結到你的專案
supabase link --project-ref your-project-ref

# 推送資料庫結構
supabase db push
```

### 選項 B: 使用 Supabase SQL Editor

1. 登入 [Supabase Dashboard](https://app.supabase.com)
2. 選擇你的專案
3. 進入 **SQL Editor**
4. 複製 `docs/database-schema.md` 中的所有 SQL 語句
5. 執行 SQL 語句創建表結構和 RLS 策略

### 驗證資料庫結構

```sql
-- 檢查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('jobs', 'job_images', 'orders');

-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'job_images', 'orders');
```

## 2. 設定環境變數

### Vercel 環境變數設定

在 Vercel Dashboard → Project Settings → Environment Variables 設定：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Runware API
RUNWARE_API_KEY=your-runware-api-key

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id

# Sentry (可選但建議)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# Domain
DOMAIN=https://your-domain.com

# 關閉 Mock 模式
NEXT_PUBLIC_USE_MOCK=false

# Node Environment
NODE_ENV=production
```

### 驗證環境變數

```bash
# 拉取 Vercel 環境變數到本地驗證
vercel env pull .env.local

# 檢查關鍵變數
grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_USE_MOCK|RUNWARE_API_KEY" .env.local
```

## 3. 測試真實流程

### API 健康檢查

```bash
# 本地測試（確保 NEXT_PUBLIC_USE_MOCK=false）
NEXT_PUBLIC_USE_MOCK=false pnpm dev

# 在另一個終端運行健康檢查
pnpm check:api
```

### E2E 測試

```bash
# Mock 模式 E2E 測試（驗證流程完整性）
NEXT_PUBLIC_USE_MOCK=true pnpm test:e2e

# 真實模式健康檢查
NEXT_PUBLIC_USE_MOCK=false pnpm health:check
```

### 手動測試流程

1. **登入測試**
   - 訪問 `/auth/login`
   - 使用 Magic Link 登入
   - 確認成功重定向

2. **生成測試**
   - 訪問 `/generate`
   - 上傳圖片、選擇風格和模板
   - 點擊生成，確認跳轉到 `/progress/:id`

3. **結果測試**
   - 等待生成完成
   - 確認 `/results/:id` 顯示圖片
   - 測試下載功能

4. **付款測試**
   - 訪問 `/pricing`
   - 點擊 "Pay with PayPal"
   - 完成測試付款流程

5. **訂單測試**
   - 訪問 `/orders`
   - 確認訂單列表顯示正確

## 4. 部署至 Vercel

### 部署前檢查

- [ ] 所有環境變數已設定
- [ ] 資料庫結構已建立
- [ ] RLS 策略已啟用
- [ ] 本地測試通過
- [ ] 代碼已提交到 Git

### 部署步驟

```bash
# 安裝 Vercel CLI (如果還沒安裝)
npm install -g vercel

# 登入 Vercel
vercel login

# 部署到預覽環境
vercel

# 部署到生產環境
vercel --prod
```

### 部署後驗證

1. **檢查部署狀態**
   - 訪問 Vercel Dashboard
   - 確認部署成功
   - 檢查構建日誌

2. **驗證環境變數**
   ```bash
   vercel env pull .env.production
   ```

3. **測試生產環境**
   - 訪問生產 URL
   - 運行健康檢查：`BASE_URL=https://your-domain.com pnpm health:check`

### Webhook 配置

#### PayPal Webhook

1. 登入 [PayPal Developer Dashboard](https://developer.paypal.com)
2. 進入你的應用程式
3. 設定 Webhook URL: `https://your-domain.com/api/payments/webhook`
4. 訂閱事件：
   - `PAYMENT.CAPTURE.COMPLETED`
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.DENIED`

#### Supabase Webhooks (可選)

如果需要即時更新，可以設定 Supabase Webhooks：
- `jobs` 表更新時觸發
- `orders` 表更新時觸發

## 5. 上線後監控

### Sentry 監控

1. **設定 Sentry 專案**
   - 登入 [Sentry Dashboard](https://sentry.io)
   - 創建新專案（Next.js）
   - 獲取 DSN

2. **監控重點**
   - API 錯誤率
   - 生成任務失敗
   - 付款 webhook 異常
   - 用戶認證問題

3. **設定告警**
   - 錯誤率超過閾值
   - 關鍵功能失敗
   - 性能問題

### Supabase 監控

1. **檢查日誌**
   - Supabase Dashboard → Logs
   - 監控 API 請求
   - 檢查錯誤日誌

2. **資料庫監控**
   - 檢查表大小
   - 監控查詢性能
   - 檢查 RLS 策略執行

### 保留 Mock 模式

Mock 模式應保留用於：
- **Staging 環境測試**
- **Demo 展示**
- **開發環境**

設定方式：
```bash
# Staging 環境
NEXT_PUBLIC_USE_MOCK=true

# Production 環境
NEXT_PUBLIC_USE_MOCK=false
```

## 6. 上線後檢查清單

### 第一天

- [ ] 監控 Sentry 錯誤日誌
- [ ] 檢查 Supabase 日誌
- [ ] 驗證 PayPal webhook 接收
- [ ] 測試完整用戶流程
- [ ] 檢查性能指標

### 第一週

- [ ] 分析用戶行為
- [ ] 優化慢查詢
- [ ] 調整 RLS 策略（如需要）
- [ ] 收集用戶反饋
- [ ] 修復發現的問題

### 持續監控

- [ ] 每日檢查 Sentry
- [ ] 每週檢查 Supabase 使用量
- [ ] 每月檢查性能指標
- [ ] 定期更新依賴

## 7. 緊急回滾計劃

如果上線後發現嚴重問題：

1. **快速回滾**
   ```bash
   # 在 Vercel Dashboard 回滾到上一個版本
   # 或使用 CLI
   vercel rollback
   ```

2. **啟用 Mock 模式**
   - 在 Vercel 環境變數中設置 `NEXT_PUBLIC_USE_MOCK=true`
   - 重新部署

3. **修復問題**
   - 在本地修復
   - 測試通過後重新部署

## 8. 支援資源

- **文檔**: `docs/` 目錄
- **數據庫結構**: `docs/database-schema.md`
- **遷移指南**: `docs/MIGRATION_GUIDE.md`
- **健康檢查**: `pnpm health:check`
- **API 檢查**: `pnpm check:api`

---

## ✅ 最終確認

在點擊「部署到生產」之前，確認：

- [ ] 所有環境變數已設定
- [ ] 資料庫結構已建立
- [ ] RLS 策略已啟用
- [ ] 本地測試通過
- [ ] E2E 測試通過
- [ ] 健康檢查通過
- [ ] Webhook 已配置
- [ ] Sentry 已配置
- [ ] 監控已設定
- [ ] 回滾計劃已準備

**準備就緒！🚀**


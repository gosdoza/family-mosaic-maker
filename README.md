# Family Mosaic Maker

A Next.js application for creating beautiful family mosaics.

## Getting Started

1. Copy `.env.local.example` to `.env.local` and fill in your environment variables
2. Install dependencies: `pnpm install`
3. Run the development server: `pnpm dev`

## Vercel Env

### Environment Variables Configuration

When deploying to Vercel, configure the following environment variables:

#### Mock Mode

- **Preview**: Set `NEXT_PUBLIC_USE_MOCK=true` for preview deployments (allows testing without real API integrations)
- **Production**: Set `NEXT_PUBLIC_USE_MOCK=false` for production deployments (requires real API credentials)

#### Supabase Configuration

Configure Supabase Redirect URLs in your Supabase Dashboard:

- Add `{DOMAIN}/auth/callback` to allowed redirect URLs
- Add `{DOMAIN}/auth/*` to allowed redirect URLs

Where `{DOMAIN}` is your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

**📚 Full Guide:** See [Supabase Auth URL Configuration](./docs/deploy/supabase-auth-urls.md) for detailed setup instructions.

### Required Environment Variables

See `.env.local.example` for the complete list of required environment variables.

## Authentication

### Local Verification

Before deploying, verify that the authentication callback route works locally:

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Open the callback page in your browser:
   ```
   http://localhost:3000/auth/callback?code=dev-ok
   ```

3. You should see a "Callback OK" page with the code parameter displayed.

4. If the page renders correctly, the route is configured properly.

### Supabase Configuration

**📚 Complete Guide:** See [Supabase Auth URL Configuration Guide](./docs/deploy/supabase-auth-urls.md) for:
- Step-by-step Supabase Dashboard configuration
- Development, Preview, and Production URL setup
- Troubleshooting tips
- Quick reference checklist

**Quick Setup Checklist:**
- [ ] Site URL set to `http://localhost:3000` (for development)
- [ ] `http://localhost:3000/auth/callback` added to Redirect URLs
- [ ] Preview domain pattern added: `https://family-mosaic-maker-*.vercel.app/auth/callback`
- [ ] Production domain added when ready: `https://family-mosaic-maker.vercel.app/auth/callback`

## Smoke Tests

### Signed Download Smoke Test

Test signed URL download functionality:

```bash
pnpm smoke:signed-download
```

This script will:
1. Upload a test file to the `originals` bucket
2. Generate a signed URL (10 minutes expiry)
3. Immediately download the file (should succeed)
4. Wait for the signed URL to expire
5. Attempt to download again (should fail with 403/401)
6. Clean up the test file
7. Log results to `analytics_logs` (type: `retention_smoke`)

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL` environment variable
- `SUPABASE_SERVICE_ROLE_KEY` environment variable
- Supabase Storage bucket `originals` must exist and be accessible

## Provider 快速切換

### 一鍵回退到 FAL

當需要快速回退到 FAL 供應商時，可以使用以下方法：

#### 方法 1: SQL 更新（推薦，即時生效）

```sql
-- 一鍵回退到 FAL（即時生效，無需重新部署）
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    description = 'Provider weights: 100% FAL, 0% Runware (Quick Rollback)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

**驗證回退成功**:
```bash
curl -s https://<domain>/api/health | jq '.providers.config.weights'
```

**預期輸出**:
```json
{
  "fal": 1.0,
  "runware": 0.0
}
```

#### 方法 2: 環境變數更新（需要重新部署）

```bash
# 設置權重為 100% FAL
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":1.0,"runware":0.0}

# 重新部署
vercel --prod
```

#### 方法 3: 使用腳本（如果可用）

```bash
# 如果存在 switch-provider.mjs 腳本
node scripts/ops/switch-provider.mjs fal
```

### 相關文檔

- **總覽**: [Provider Dual Source Playbook](./docs/provider_dual_source_playbook.md)
- **灰度手冊**: [Runware 灰度發布計劃](./docs/rollout_runware.md)
- **成本護欄**: [Cost Guard Runbook](./docs/runbook_cost_guard.md)
- **驗收報告**: [Gate C 雙供應商驗收報告](./docs/qa/gate_c_dual_provider.md)

## QA 一鍵檢測

### 快速開始

本地（或 CI）執行完整 QA 測試套件：

```bash
# 1. 安裝依賴
pnpm install

# 2. 安裝 Playwright 瀏覽器
npx playwright install

# 3. 執行所有 QA 測試
pnpm qa:run-all
```

### 測試報告

測試完成後，報告會自動生成到：

```
docs/qa/qa_summary.md
```

報告包含：
- 環境矩陣（Preview/Prod 與 NEXT_PUBLIC_USE_MOCK）
- Providers 權重與狀態
- 每個測試段落的 ✅/❌ 狀態
- 關鍵指標（p95、error_rate、gen_route provider 分布）
- 最後結論（PASS/FAIL）與下一步建議

### 單獨執行測試

#### E2E 測試

```bash
# 認證流程測試
pnpm test:e2e:auth

# 生成流程測試（Mock & Real Runware）
pnpm test:e2e:generate

# PayPal 支付流程測試
pnpm test:e2e:paypal
```

#### API Smoke 測試

```bash
# API 健康檢查與限流測試
pnpm qa:smoke-api

# Headers 安全檢查
pnpm qa:headers

# 簽名 URL 過期測試
pnpm qa:signed-url
```

### 失敗排查順序

1. **檢查環境變數**
   ```bash
   # 確認必要環境變數已設置
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   echo $NEXT_PUBLIC_USE_MOCK
   ```

2. **檢查健康狀態**
   ```bash
   curl -s http://localhost:3000/api/health | jq '.'
   ```

3. **查看測試報告**
   ```bash
   cat docs/qa/qa_summary.md
   ```

4. **檢查 Playwright 報告**
   ```bash
   npx playwright show-report
   ```

### 常見錯誤碼對照

| 錯誤碼 | 說明 | 解決方案 |
|--------|------|----------|
| `E_MODEL_MISCONFIG` | 模型配置錯誤 | 檢查 `FAL_API_KEY` 或 `RUNWARE_API_KEY` 是否設置 |
| `E_RATE_LIMITED` | 請求頻率超限 | 等待 `Retry-After` 時間後重試 |
| `E_IDEMPOTENT_REPLAY` | 冪等鍵重複 | 使用新的 `X-Idempotency-Key` |
| `401` | 未授權 | 檢查認證狀態，確認已登入 |
| `429` | 請求頻率超限 | 檢查 `Retry-After` 頭，降低請求頻率 |
| `503` | 服務不可用 | 檢查 Providers 狀態，確認 API Key 配置正確 |

### 測試覆蓋範圍

QA 測試套件包含：

1. **E2E 測試**
   - 認證流程（註冊/登入/登出）
   - 生成流程（Mock 與真實 Runware）
   - PayPal 支付流程（Sandbox）

2. **API Smoke 測試**
   - `/api/health` 健康檢查
   - `/api/upload/sign` 認證與限流
   - `/api/results/[id]` 事件記錄

3. **數據庫驗證**
   - RLS（Row Level Security）權限檢查
   - Metrics 指標驗證（p95、錯誤率）

4. **安全檢查**
   - Headers 驗證（CSP、X-Frame-Options 等）
   - 簽名 URL 過期測試

### CI/CD 集成

在 CI 中執行 QA 測試：

```yaml
# GitHub Actions 示例
- name: Run QA Tests
  run: |
    pnpm install
    npx playwright install --with-deps
    pnpm qa:run-all
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    NEXT_PUBLIC_USE_MOCK: ${{ secrets.NEXT_PUBLIC_USE_MOCK }}
```


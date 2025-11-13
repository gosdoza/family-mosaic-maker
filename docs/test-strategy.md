# Test Strategy（v1.0）

## 1) 目的與範圍

目的：用最小成本、最高覆蓋率驗證本產品在**功能、效能、安全、法遵、金流**與**生成供應商**串接的健全度。  

範圍：前端（Next.js）、後端 API（/app/api/*）、Supabase（DB/RLS/Storage/Edge Functions）、第三方（Runware、PayPal、GA4、Logflare）。  

版本：v1.0（隨發版演進；每次 release 以此作為驗收標準）。

## 2) 測試金字塔與責任

| 層級 | 內容 | 工具 | 維護角色 |
|---|---|---|---|
| L1 Unit | 純函式、utility、格式化、zod schema | Vitest/Jest | Dev |
| L2 System/API | API 合約、RLS、限流、Header/CSP、Webhook | Bash/Node/SQL、k6 | QA/Backend |
| L3 E2E | 登入→上傳→生成→預覽→支付→下載 | Playwright | QA |
| L4 KPI/監控 | p95、錯誤率、降級開關、GDPR SLA | k6、/api/health、Logflare、SQL | PM/QA |

## 3) 測試環境矩陣

| 環境 | 變數 | 供應商權重 | 目的 |
|---|---|---|---|
| Dev(Local) | `NEXT_PUBLIC_USE_MOCK=true` | 任意 | 開發自測 |
| Preview | `NEXT_PUBLIC_USE_MOCK=true` | 任意 | PR 驗收、無金流 |
| Production Sandbox | `NEXT_PUBLIC_USE_MOCK=false` | `{"fal":0,"runware":1}` | 真實串接驗收（PayPal Sandbox + Runware） |

## 4) 驗收 KPI 與門檻（D13/D20 Gate）

可靠性：`/api/health.ok = true`  

效能：端對端 `p95 < 8s`（30 分鐘樣本）；錯誤率 `< 1%`（k6 60 rps × 3m）  

測試通過率：System/API ≥ 90%，E2E ≥ 90%  

安全/法遵：CSP/Headers 合規、RLS 無越權、GDPR 刪除 ≤ 72h  

商業：支付成功率 ≥ 95%，退款率 ≤ 2%

## 5) 數據與種子

`supabase/seed.sql`：3 測試帳號、5 模板、3 assets（含 1 paid/1 refunded）  

以 `request_id` 串聯 `analytics_logs`

## 6) 自動化策略

**一鍵 QA**：`pnpm qa:run-all` → `docs/qa/qa_summary.md`  

**System/API 報告**：`docs/system-tests-report.md`  

**E2E 報告**：`docs/e2e-report.md`  

失敗優先排查：Health → Env/權重 → RLS/簽名 URL → 生成服務 → 金流 Webhook → 前端流程

## 7) 風險與降級

生成逾限/失敗率上升 → 自動降級（解析度、步數、流量）＋補償券  

金流 Webhook 延遲 → 冪等補償（憑證補發）  

供應商不可用 → 權重/Mock 切換




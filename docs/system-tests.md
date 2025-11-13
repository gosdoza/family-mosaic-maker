# System / API 測試清單（v1.0）

目的：以**黑箱 API 驗證**＋**SQL 探測**快速確認系統層是否健康（不進 UI 也能發現大多數後端問題）。

## A. 健康檢查（必跑）

- `/api/health` 應回 `200` 並 `ok=true`

- 權重：`providers.config.weights={"fal":0,"runware":1}`（或依當前策略）

- Runware：`providers.runware.ok=true`（可接受 400/404，但需有 api key 且邏輯判定 ok）

- Retention 子檢查存在

**Unhappy**：`ok=false`、權重不符、`runware.ok=false`

## B. 安全標頭 / CSP

驗證 `X-Content-Type-Options:nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`frame-ancestors`（僅允許 PayPal）與 CSP 白名單

## C. Storage & 簽名 URL

1) bucket：`originals` / `previews` / `assets`  

2) 產生簽名 URL → 立即下載 200、過期後 400/401/403  

3) 未登入不可產生簽名

**Unhappy**：bucket 不存在、過期後仍可下載

## D. RLS 權限

不同用戶不可讀取彼此 `images / assets / orders`；未登入 401/403；delete 禁止

## E. 生成服務（Runware）

`POST /api/generate` → `202 { job_id, eta_sec, request_id }`  

`GET /api/progress/:job_id` → running/succeeded  

失敗：逾時重試 1 次仍敗 → `E_MODEL_FAIL`

## F. 金流（PayPal Sandbox）

`POST /api/pay/create`（帶 `X-Idempotency-Key`）  

第一次 200；重放同 key → `409`  

Webhook：COMPLETED → `orders.status=paid` & `assets.paid=true`  

前端中斷補發：仍能於 Dashboard 取得

## G. 速率限制 / 風險控管

IP ≤ 10/min；試用 ≤ 5/day；超限 → `429` + `Retry-After: 600`；連 3 次 `429` → 冷卻 30 分

## 報告輸出

路徑：`/docs/system-tests-report.md`（PASS/FAIL、錯誤摘要、建議修復順序）




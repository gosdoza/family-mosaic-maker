# E2E 場景清單（v1.0）

目的：以**終端用戶視角**覆蓋**核心旅程**（happy）與**錯誤/例外**（unhappy），確保真實使用無阻塞。

## E2E-01｜註冊/登入/登出（Happy）

步驟：`/auth/login` → Magic Link 登入 → Dashboard → 登出  

期望：顯示 email，事件 `auth_login_ok`

**Unhappy**：錯誤 token/過期連結 → 友善錯誤與重試

## E2E-02｜上傳與預覽（Happy）

上傳 2–5 張 → 取 `asset_id` → `/result?asset_id=…` 出現 1024 預覽（水印）  

期望：EXIF 移除、水印可見、`upload_*` / `preview_view` 齊全

**Unhappy**：超上限（張數/大小）→ 429/驗證錯

## E2E-03｜生成（Happy）

選模板/風格 → 生成 → 約定時間內看到結果  

期望：`gen_start`→`gen_ok`，`p95 < 8s`

**Unhappy**：Runware 逾時/失敗 → 自動重試 1 次，仍敗顯示錯誤＋再試券

## E2E-04｜支付（PayPal Sandbox｜Happy）

支付 → create（冪等鍵）→ capture/confirm → 返回  

期望：`orders.status=paid`、`assets.paid=true`、UI 顯示已解鎖、「Charged in USD」

**Unhappy**：重放冪等鍵 → `409`；Webhook 延遲 → 自動補發憑證

## E2E-05｜下載（Happy）

結果頁下載高畫質 zip → 成功  

期望：GA `download_click`、簽名 URL 一次性/限時

**Unhappy**：簽名過期 → 友善提示與重取流程

## E2E-06｜GDPR 刪除（Happy）

提交刪除 → `pending`→`processing`→`done`（≤72h）  

**Unhappy**：無權限/不一致 → 提示 SLA 與客服路徑

## E2E-07｜多語/SEO（Happy）

切 EN/ZH → 驗證 hreflang/canonical/sitemap（無 404；GSC 可收錄）

## 報告輸出

路徑：`/docs/e2e-report.md`（每場景 PASS/FAIL、截圖連結）




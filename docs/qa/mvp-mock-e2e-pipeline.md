# Mock E2E Pipeline 使用指南

## 簡介（Introduction）

這條 Pipeline 是「Mock MVP 全功能 E2E 驗收」的總整腳本。它會依序執行所有核心 QA 腳本，一次完成 Smoke Test、Auth Edge Cases、Generate Flow、Pricing Flow 和 Orders Flow 的完整驗證。

**一句話說明**：一次跑完所有 Mock MVP 核心功能的 E2E 檢查，確保所有模組運作正常。

---

## 目前納入的 QA 腳本列表

| Label | Script Path | Purpose |
|-------|-------------|---------|
| MVP E2E Smoke | `scripts/qa/mvp-e2e-smoke.mjs` | 針對 Production 環境執行基本的 E2E 檢查，驗證核心頁面與 API 端點可正常存取 |
| Auth Edge Cases | `scripts/qa/auth-edge-cases.mjs` | 針對 Auth Flow 邊界情境的自動化檢查，驗證 redirect 行為和錯誤頁面文案 |
| MVP Generate Flow | `scripts/qa/mvp-generate-flow.mjs` | 驗證 Generate Flow（Mock 版）完整流程：Landing → Generate → Create Job → Progress → Results → Orders |
| MVP Pricing Flow | `scripts/qa/mvp-pricing-flow.mjs` | 驗證 Pricing Flow（Mock 版）：Pricing 頁面、付費結果頁面、Checkout API、PayPal 相關 API 的 auth 保護 |
| MVP Orders Flow | `scripts/qa/mvp-orders-flow.mjs` | 驗證 Orders Flow（Mock 版）：Orders 頁面、Orders API 的 auth 保護與資料結構、付費狀態結果頁面 |

---

## 如何執行（Usage）

### Local（dev server 在 3000）

```bash
QA_BASE_URL="http://localhost:3000" pnpm qa:mock-e2e-all
```

### Production

```bash
QA_BASE_URL="https://family-mosaic-maker.vercel.app" pnpm qa:mock-e2e-all
```

### 使用預設 Base URL

如果沒有設定 `QA_BASE_URL`，則每支腳本會使用各自內建的預設 base URL（目前預設為 `https://family-mosaic-maker.vercel.app`）：

```bash
pnpm qa:mock-e2e-all
```

---

## 成功與失敗的判斷

### 成功情況

全部腳本 exit code 為 0 → Pipeline 成功完成，會看到：

```
✅ Mock E2E pipeline finished successfully.
```

### 失敗情況

任一腳本失敗 → Pipeline 立即中斷，exit code 1，會看到：

```
[FAIL] [Label] (Exit code: X)
❌ Mock E2E pipeline failed.
```

Pipeline 採用「快速失敗」（fail-fast）策略：一旦某個腳本失敗，會立即停止執行後續腳本，並回報錯誤。

---

## 何時要跑這條 Pipeline？

建議在以下情境執行：

1. **每次要部署到 Production 前**
   - 確保所有核心功能在 Production 環境正常運作

2. **每次大改 Auth / Generate / Pricing / Orders 其中任一模組**
   - 驗證修改沒有破壞現有功能

3. **之後接入真模型、真金流前**
   - 先確保 Mock 版仍然穩定，作為 baseline

4. **定期回歸測試**
   - 例如每週或每次 release 前執行一次

---

## 技術細節

### 執行方式

- 使用 Node.js `child_process.spawn` 依序執行各子腳本
- 環境變數（特別是 `QA_BASE_URL`）會自動傳遞給所有子腳本
- 所有子腳本的輸出會直接顯示在終端機（`stdio: "inherit"`）

### 腳本位置

- 總管腳本：`scripts/qa/mvp-mock-e2e-all.mjs`
- package.json 指令：`qa:mock-e2e-all`

### 依賴

- 僅使用 Node.js 內建模組（`node:child_process`、`node:path`、`node:url`）
- 無需額外 npm 套件

---

## 疑難排解

### 問題：某個腳本一直失敗

1. 先單獨執行該腳本，確認問題：
   ```bash
   QA_BASE_URL="http://localhost:3000" node scripts/qa/[script-name].mjs
   ```

2. 檢查該腳本的個別文件（位於 `docs/qa/` 目錄）

### 問題：環境變數沒有傳遞

確認使用正確的語法：
- ✅ `QA_BASE_URL="..." pnpm qa:mock-e2e-all`
- ❌ `pnpm qa:mock-e2e-all QA_BASE_URL="..."`（錯誤）

### 問題：Local dev server 沒有啟動

確保 dev server 正在運行：
```bash
pnpm dev
```

然後在另一個終端執行 Pipeline。

---

## Mock vs Real 的差異

### Mock E2E Pipeline（本文件）
- **用途**：驗證 Mock 模式下的完整流程
- **Provider**：`GENERATION_PROVIDER=mock` 或 `NEXT_PUBLIC_USE_MOCK=true`
- **特點**：
  - 不呼叫外部 API（Runware/FAL）
  - 使用內存狀態機模擬生成流程
  - 返回 Mock 圖片 URL
  - 適合開發、測試、CI/CD

### Real E2E Pipeline（未來）
- **用途**：驗證真實模型（Runware）下的生成流程
- **Provider**：`GENERATION_PROVIDER=runware`
- **特點**：
  - 實際呼叫 Runware API
  - 需要 `RUNWARE_API_KEY`
  - 會產生費用
  - 適合 Production 驗證、真實環境測試
- **相關文件**：`docs/real-e2e/generate-flow.md`

## 相關文件

- 各腳本的詳細說明：
  - `docs/qa/mvp-e2e-checklist.md`
  - `docs/qa/auth-edge-cases-spec.md`
  - `docs/qa/mvp-generate-flow.md`
  - `docs/qa/mvp-pricing-flow.md`
  - `docs/qa/mvp-orders-flow.md`
  - `docs/real-e2e/generate-flow.md`（Real Generate Flow）


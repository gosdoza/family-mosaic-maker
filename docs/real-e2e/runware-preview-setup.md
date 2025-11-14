# Runware Preview 設定教學

**最後更新**: 2025-01-XX  
**用途**: 在 Vercel Preview 環境測試 Runware 真實生圖功能

---

## 2.1 概念說明

### 什麼是「Runware Preview」？

Runware Preview 是一種測試策略，讓你在不影響 Production 環境的前提下，測試 Runware 真實生圖功能：

- **Production 環境**：維持 `NEXT_PUBLIC_USE_MOCK=true`（預設走 Mock，不燒錢）
- **Preview 環境**：切換到 `GENERATION_PROVIDER=runware`，專門用來測真生圖
- **隔離測試**：Preview 的測試不會影響 Production 用戶體驗

### Mock Flow vs Real Runware Flow 的差別

| 特性 | Mock Flow | Real Runware Flow |
|------|-----------|-------------------|
| **環境變數** | `NEXT_PUBLIC_USE_MOCK=true` | `GENERATION_PROVIDER=runware` |
| **圖片生成** | 內存狀態機模擬（90 秒） | Runware API 真實生成 |
| **圖片來源** | 本地 `/assets/mock/` 或占位符 | Runware 返回的實際圖片 URL |
| **費用** | 免費 | 會產生 Runware API 費用 |
| **適用場景** | 開發、測試、Production | Preview 測試、真實環境驗證 |

---

## 2.2 Vercel Preview 環境變數設定

### Checklist

請按照以下步驟在 Vercel 設定 Preview 環境：

#### 步驟 1：建立 Preview Branch（可選）

如果你想要一個專門的 Preview branch：

```bash
# 建立並切換到新 branch
git checkout -b runware-preview
git push origin runware-preview
```

或者直接使用現有的 feature branch。

#### 步驟 2：在 Vercel 設定 Preview Environment Variables

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案（family-mosaic-maker）
3. 進入 **Settings** → **Environment Variables**
4. 在 **Preview** 環境中新增以下變數：

   | 變數名稱 | 值 | 說明 |
   |---------|-----|------|
   | `GENERATION_PROVIDER` | `runware` | 強制使用 Runware Provider |
   | `RUNWARE_API_KEY` | `<你的 Runware API Key>` | Runware API 認證金鑰 |

5. **重要**：確認 **Preview** 環境中**沒有設定** `NEXT_PUBLIC_USE_MOCK`，或將其清空，避免 override provider 設定。

#### 步驟 3：確認 Production 環境變數

**⚠️ 重要**：確認 **Production** 環境中：

- ✅ `NEXT_PUBLIC_USE_MOCK=true` 仍然存在（確保 Production 走 Mock）
- ❌ **不要**在 Production 設定 `GENERATION_PROVIDER=runware`

#### 步驟 4：觸發 Preview Deployment

1. Push 你的 branch 到 GitHub
2. Vercel 會自動建立 Preview Deployment
3. 等待 Deployment 完成，記下 Preview Domain（例如：`https://family-mosaic-maker-git-runware-preview-xxxxx.vercel.app`）

---

## 2.3 在本機對 Preview 跑 QA 的指令範例

### 方法 1：直接呼叫底層 QA Script

```bash
QA_BASE_URL="https://<your-preview-domain>" \
GENERATION_PROVIDER=runware \
RUNWARE_API_KEY="你的 Runware Key" \
pnpm qa:real-generate-flow
```

**說明**：
- 需要手動指定 `GENERATION_PROVIDER=runware`
- 需要手動指定 `RUNWARE_API_KEY`
- 適合需要靈活控制環境變數的情況

### 方法 2：使用 Runware Preview 專用指令（建議）

```bash
QA_BASE_URL="https://<your-preview-domain>" \
RUNWARE_API_KEY="你的 Runware Key" \
pnpm qa:real-generate-preview
```

**說明**：
- ✅ 自動設定 `GENERATION_PROVIDER=runware`（不需要手動指定）
- ✅ 只需要指定 `QA_BASE_URL` 和 `RUNWARE_API_KEY`
- ✅ 更簡潔，減少打錯環境變數的機會

**範例**（假設 Preview Domain 是 `https://family-mosaic-maker-git-runware-preview-abc123.vercel.app`）：

```bash
QA_BASE_URL="https://family-mosaic-maker-git-runware-preview-abc123.vercel.app" \
RUNWARE_API_KEY="rw_xxxxxxxxxxxxx" \
pnpm qa:real-generate-preview
```

---

## 2.4 建議的驗收步驟

### 步驟 1：確認 Preview Deployment

1. ✅ 確認 Preview deployment 成功，domain 可用
   - 在 Vercel Dashboard 檢查 Deployment 狀態
   - 訪問 Preview Domain，確認網站正常載入

2. ✅ 確認 Vercel Preview 環境變數設定正確
   - 在 Vercel Dashboard → Settings → Environment Variables
   - 確認 Preview 環境有設定：
     - `GENERATION_PROVIDER=runware`
     - `RUNWARE_API_KEY=<你的 key>`
   - 確認 Preview 環境**沒有** `NEXT_PUBLIC_USE_MOCK=true`

### 步驟 2：執行 QA 測試

在本機執行：

```bash
QA_BASE_URL="https://<your-preview-domain>" \
RUNWARE_API_KEY="你的 Runware Key" \
pnpm qa:real-generate-preview
```

**預期結果**：
- ✅ API Version Check 通過
- ⚠️ POST /api/generate 可能返回 401（需要認證，這是正常的）
- ⚠️ Progress / Results 檢查可能返回 401 或 404（如果沒有認證或 job 不存在）

**注意**：QA 腳本主要是驗證 API 端點可訪問，實際的生成流程需要透過瀏覽器測試。

### 步驟 3：瀏覽器手動測試

1. 打開 Preview Domain：`https://<your-preview-domain>/generate`

2. 上傳一張測試圖片
   - 選擇一張測試用的圖片
   - 選擇 Style 和 Template

3. 點擊 Generate
   - 觀察是否成功創建 job
   - 檢查 Network tab，確認 API 回應

4. 查看 Progress
   - 確認進度條正常顯示
   - 確認狀態從 `queued` → `running` → `succeeded`

5. 查看 Results
   - 確認圖片是 Runware 真實生成的圖片（而非 Mock 圖片）
   - 檢查圖片 URL 是否來自 Runware API
   - 確認圖片可以正常顯示

### 步驟 4：驗證 Production 未被影響

1. ✅ 訪問 Production Domain：`https://family-mosaic-maker.vercel.app/generate`
2. ✅ 確認 Production 仍然使用 Mock 模式（不呼叫 Runware API）
3. ✅ 確認 Production 用戶體驗正常

---

## 疑難排解

### 問題：Preview 仍然走 Mock 模式

**可能原因**：
- Preview 環境變數中仍有 `NEXT_PUBLIC_USE_MOCK=true`
- `GENERATION_PROVIDER` 設定錯誤

**解決方法**：
1. 檢查 Vercel Preview 環境變數
2. 確認 `NEXT_PUBLIC_USE_MOCK` 已清空或刪除
3. 確認 `GENERATION_PROVIDER=runware` 已設定
4. 重新部署 Preview

### 問題：QA 腳本返回 401 Unauthorized

**說明**：這是正常的，因為 `/api/generate` 需要認證。

**解決方法**：
- 使用瀏覽器手動測試（已登入狀態）
- 或使用 E2E 測試工具（如 Playwright）模擬登入

### 問題：Runware API 呼叫失敗

**可能原因**：
- `RUNWARE_API_KEY` 設定錯誤
- Runware API 服務異常
- 網路連線問題

**解決方法**：
1. 檢查 `RUNWARE_API_KEY` 是否正確
2. 檢查 Runware API 服務狀態
3. 檢查 Preview Deployment 的 Logs

---

## 相關文件

- [Real Generate Flow 規格文件](./generate-flow.md)
- [Runware Provider 實作報告](./runware-provider-implementation.md)
- [QA 腳本總覽](../qa/README.md)

---

## 快速參考

### 一條指令跑 Preview QA

```bash
QA_BASE_URL="https://<your-preview-domain>" \
RUNWARE_API_KEY="你的 Runware Key" \
pnpm qa:real-generate-preview
```

### Vercel Preview 環境變數 Checklist

- [ ] `GENERATION_PROVIDER=runware`
- [ ] `RUNWARE_API_KEY=<你的 key>`
- [ ] `NEXT_PUBLIC_USE_MOCK` 已清空或刪除
- [ ] Production 環境的 `NEXT_PUBLIC_USE_MOCK=true` 保持不變


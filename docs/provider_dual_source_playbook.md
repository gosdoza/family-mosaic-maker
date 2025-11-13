# Provider Dual Source Playbook

本文档提供 FAL + Runware 双源供应商的配置、切换和故障处理指南。

## 📋 目錄

- [概述](#概述)
- [環境變數矩陣（FAL+Runware）](#環境變數矩陣falrunware)
- [配置說明](#配置說明)
- [切換流程](#切換流程)
- [故障處理](#故障處理)
- [監控與驗證](#監控與驗證)

## 🔍 概述

### 雙源供應商架構

系統支持兩個模型供應商：
- **FAL**: 主要供應商（預設）
- **Runware**: 備用供應商（已弃用，保留用於兼容性）

### 功能特性

- **主供應商配置**: 通過 `GEN_PROVIDER_PRIMARY` 指定主要供應商
- **權重分配**: 通過 `GEN_PROVIDER_WEIGHTS` 配置流量分配
- **自動故障切換**: 通過 `GEN_FAILOVER` 啟用自動故障切換
- **超時控制**: 通過 `GEN_TIMEOUT_MS` 設置請求超時
- **重試機制**: 通過 `GEN_RETRY` 設置重試次數

## 🔧 環境變數矩陣（FAL+Runware）

### Preview 環境

| 變數 | 值 | 必填 | 說明 |
|------|-----|------|------|
| `FAL_API_KEY` | `your-fal-api-key` | ✅ 是 | FAL API 密鑰 |
| `FAL_MODEL_ID` | `fal-ai/flux/schnell` | ⚠️ 可選 | FAL 模型 ID（預設：fal-ai/flux/schnell） |
| `RUNWARE_API_KEY` | `your-runware-api-key` | ⚠️ 可選 | Runware API 密鑰（已弃用） |
| `GEN_PROVIDER_PRIMARY` | `fal` | ⚠️ 可選 | 主要供應商（預設：fal） |
| `GEN_PROVIDER_WEIGHTS` | `{"fal":1.0,"runware":0.0}` | ⚠️ 可選 | 供應商權重分配（預設：{"fal":1.0,"runware":0.0}） |
| `GEN_TIMEOUT_MS` | `8000` | ⚠️ 可選 | 請求超時（毫秒，預設：8000） |
| `GEN_RETRY` | `2` | ⚠️ 可選 | 重試次數（預設：2） |
| `GEN_FAILOVER` | `true` | ⚠️ 可選 | 啟用自動故障切換（預設：true） |

### Production 環境

| 變數 | 值 | 必填 | 說明 |
|------|-----|------|------|
| `FAL_API_KEY` | `your-fal-api-key` | ✅ 是 | FAL API 密鑰 |
| `FAL_MODEL_ID` | `fal-ai/flux/schnell` | ⚠️ 可選 | FAL 模型 ID（預設：fal-ai/flux/schnell） |
| `RUNWARE_API_KEY` | `your-runware-api-key` | ⚠️ 可選 | Runware API 密鑰（已弃用） |
| `GEN_PROVIDER_PRIMARY` | `fal` | ⚠️ 可選 | 主要供應商（預設：fal） |
| `GEN_PROVIDER_WEIGHTS` | `{"fal":1.0,"runware":0.0}` | ⚠️ 可選 | 供應商權重分配（預設：{"fal":1.0,"runware":0.0}） |
| `GEN_TIMEOUT_MS` | `8000` | ⚠️ 可選 | 請求超時（毫秒，預設：8000） |
| `GEN_RETRY` | `2` | ⚠️ 可選 | 重試次數（預設：2） |
| `GEN_FAILOVER` | `true` | ⚠️ 可選 | 啟用自動故障切換（預設：true） |

### 設置步驟

#### 方法 1: 使用 Vercel CLI

```bash
# 設置 FAL API Key (Preview)
vercel env add FAL_API_KEY preview
# 輸入: your-fal-api-key

# 設置 FAL API Key (Production)
vercel env add FAL_API_KEY production
# 輸入: your-fal-api-key

# 設置 FAL Model ID (Preview)
vercel env add FAL_MODEL_ID preview
# 輸入: fal-ai/flux/schnell

# 設置 FAL Model ID (Production)
vercel env add FAL_MODEL_ID production
# 輸入: fal-ai/flux/schnell

# 設置 Runware API Key (Preview) - 可選
vercel env add RUNWARE_API_KEY preview
# 輸入: your-runware-api-key

# 設置 Runware API Key (Production) - 可選
vercel env add RUNWARE_API_KEY production
# 輸入: your-runware-api-key

# 設置主要供應商 (Preview)
vercel env add GEN_PROVIDER_PRIMARY preview
# 輸入: fal

# 設置主要供應商 (Production)
vercel env add GEN_PROVIDER_PRIMARY production
# 輸入: fal

# 設置供應商權重 (Preview)
vercel env add GEN_PROVIDER_WEIGHTS preview
# 輸入: {"fal":1.0,"runware":0.0}

# 設置供應商權重 (Production)
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":1.0,"runware":0.0}

# 設置超時時間 (Preview)
vercel env add GEN_TIMEOUT_MS preview
# 輸入: 8000

# 設置超時時間 (Production)
vercel env add GEN_TIMEOUT_MS production
# 輸入: 8000

# 設置重試次數 (Preview)
vercel env add GEN_RETRY preview
# 輸入: 2

# 設置重試次數 (Production)
vercel env add GEN_RETRY production
# 輸入: 2

# 設置故障切換 (Preview)
vercel env add GEN_FAILOVER preview
# 輸入: true

# 設置故障切換 (Production)
vercel env add GEN_FAILOVER production
# 輸入: true
```

#### 方法 2: 使用 Vercel Dashboard

1. 訪問 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇項目: **family-mosaic-maker**
3. 進入 **Settings** → **Environment Variables**
4. 點擊 **Add New** 添加每個變數
5. 選擇環境（Preview / Production）
6. 點擊 **Save**

### 驗證環境變數

```bash
# 查看所有環境變數
vercel env ls

# 查看 Preview 環境變數
vercel env ls preview

# 查看 Production 環境變數
vercel env ls production
```

## ⚙️ 配置說明

### GEN_PROVIDER_PRIMARY

**說明**: 指定主要供應商

**有效值**:
- `fal`: FAL API（預設）
- `runware`: Runware API（已弃用）

**預設值**: `fal`

**示例**:
```bash
GEN_PROVIDER_PRIMARY=fal
```

### GEN_PROVIDER_WEIGHTS

**說明**: 配置供應商流量分配權重

**格式**: JSON 對象

**預設值**: `{"fal":1.0,"runware":0.0}`

**示例**:
```bash
# 100% FAL
GEN_PROVIDER_WEIGHTS={"fal":1.0,"runware":0.0}

# 50% FAL, 50% Runware
GEN_PROVIDER_WEIGHTS={"fal":0.5,"runware":0.5}

# 80% FAL, 20% Runware
GEN_PROVIDER_WEIGHTS={"fal":0.8,"runware":0.2}
```

**注意事項**:
- 權重總和應為 1.0
- 如果權重總和不等於 1.0，系統會自動歸一化
- 權重為 0 的供應商不會收到流量

### GEN_TIMEOUT_MS

**說明**: 設置請求超時時間（毫秒）

**預設值**: `8000` (8 秒)

**示例**:
```bash
GEN_TIMEOUT_MS=8000
```

**建議值**:
- 快速響應: `5000` (5 秒)
- 標準: `8000` (8 秒)
- 寬鬆: `12000` (12 秒)

### GEN_RETRY

**說明**: 設置重試次數

**預設值**: `2`

**示例**:
```bash
GEN_RETRY=2
```

**建議值**:
- 快速失敗: `1`
- 標準: `2`
- 高可靠性: `3`

### GEN_FAILOVER

**說明**: 啟用自動故障切換

**預設值**: `true`

**示例**:
```bash
GEN_FAILOVER=true
```

**功能**:
- 當主要供應商失敗時，自動切換到備用供應商
- 如果 `GEN_FAILOVER=false`，系統不會自動切換，直接返回錯誤

## 🔄 切換流程

### ⚡ 一鍵回退到 FAL（快速切換）

**方法 1: 使用 SQL（推薦，即時生效）**

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

**方法 2: 使用環境變數（需要重新部署）**

```bash
# 設置主要供應商為 FAL
vercel env add GEN_PROVIDER_PRIMARY production
# 輸入: fal

# 設置權重為 100% FAL
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":1.0,"runware":0.0}

# 重新部署
vercel --prod
```

**方法 3: 使用腳本（如果可用）**

```bash
# 如果存在 switch-provider.mjs 腳本
node scripts/ops/switch-provider.mjs fal
```

### 切換到 FAL（主要供應商）

```bash
# 設置主要供應商為 FAL
vercel env add GEN_PROVIDER_PRIMARY production
# 輸入: fal

# 設置權重為 100% FAL
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":1.0,"runware":0.0}

# 重新部署
vercel --prod
```

### 切換到 Runware（備用供應商）

```bash
# 設置主要供應商為 Runware
vercel env add GEN_PROVIDER_PRIMARY production
# 輸入: runware

# 設置權重為 100% Runware
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":0.0,"runware":1.0}

# 重新部署
vercel --prod
```

### 啟用雙源負載均衡

```bash
# 設置權重為 50% FAL, 50% Runware
vercel env add GEN_PROVIDER_WEIGHTS production
# 輸入: {"fal":0.5,"runware":0.5}

# 重新部署
vercel --prod
```

## 🚨 故障處理

### FAL 供應商故障

**症狀**:
- `/api/health` 返回 `providers.fal.ok: false`
- 生成請求失敗或超時

**處理步驟**:
1. 檢查 FAL API 密鑰是否正確
2. 檢查 FAL API 服務狀態
3. 如果 `GEN_FAILOVER=true`，系統會自動切換到 Runware
4. 如果自動切換失敗，手動切換到 Runware：
   ```bash
   vercel env add GEN_PROVIDER_PRIMARY production
   # 輸入: runware
   vercel --prod
   ```

### Runware 供應商故障

**症狀**:
- `/api/health` 返回 `providers.runware.ok: false`
- 生成請求失敗或超時

**處理步驟**:
1. 檢查 Runware API 密鑰是否正確
2. 檢查 Runware API 服務狀態
3. 如果 `GEN_FAILOVER=true`，系統會自動切換到 FAL
4. 如果自動切換失敗，手動切換到 FAL：
   ```bash
   vercel env add GEN_PROVIDER_PRIMARY production
   # 輸入: fal
   vercel --prod
   ```

### 雙源同時故障

**症狀**:
- `/api/health` 返回 `providers.fal.ok: false` 和 `providers.runware.ok: false`
- 所有生成請求失敗

**處理步驟**:
1. 檢查兩個供應商的 API 密鑰
2. 檢查兩個供應商的服務狀態
3. 啟用 Mock 模式作為臨時解決方案：
   ```bash
   vercel env add NEXT_PUBLIC_USE_MOCK production
   # 輸入: true
   vercel --prod
   ```

## 📊 監控與驗證

### 健康檢查

**端點**: `/api/health`

**檢查 Providers 狀態**:
```bash
curl -s https://<preview>/api/health | jq '.providers'
```

**預期響應**:
```json
{
  "fal": {
    "ok": true,
    "latency_ms": 125,
    "status": "ok",
    "error": null,
    "configured": true
  },
  "runware": {
    "ok": true,
    "latency_ms": 98,
    "status": "ok",
    "error": null,
    "configured": true,
    "deprecated": true
  },
  "config": {
    "primary": "fal",
    "weights": {
      "fal": 1.0,
      "runware": 0.0
    },
    "timeout_ms": 8000,
    "retry": 2,
    "failover": true
  }
}
```

### 驗證環境變數

**查看所有環境變數**:
```bash
vercel env ls
```

**查看特定環境變數**:
```bash
# Preview
vercel env ls preview | grep -E "FAL_API_KEY|RUNWARE_API_KEY|GEN_PROVIDER"

# Production
vercel env ls production | grep -E "FAL_API_KEY|RUNWARE_API_KEY|GEN_PROVIDER"
```

### 監控指標

**檢查項目**:
1. **Providers 健康狀態**: `/api/health` 返回 `providers.fal.ok` 和 `providers.runware.ok`
2. **配置值**: `/api/health` 返回 `providers.config` 與預期一致
3. **生成請求**: `/api/generate` 使用正確的供應商
4. **故障切換**: 當主要供應商失敗時，自動切換到備用供應商

**SQL 查詢**:
```sql
-- 查詢最近 5 分鐘的生成事件
SELECT 
  event_type,
  event_data->>'model_provider' as provider,
  event_data->>'model_id' as model_id,
  created_at
FROM analytics_logs
WHERE event_type IN ('gen_start', 'gen_ok', 'gen_fail')
  AND created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

## 📝 注意事項

### ⚠️ 重要提醒

1. **Runware 已弃用**: Runware 已弃用，建議使用 FAL 作為主要供應商
2. **API 密鑰安全**: 不要在代碼中硬編碼 API 密鑰，使用環境變數
3. **權重配置**: 確保權重總和為 1.0，否則系統會自動歸一化
4. **故障切換**: 建議啟用 `GEN_FAILOVER=true` 以確保高可用性
5. **監控**: 定期檢查 `/api/health` 以確保供應商狀態正常

### 🔒 安全建議

1. **環境變數加密**: 在 Vercel Dashboard 中設置環境變數，不要提交到 Git
2. **API 密鑰輪換**: 定期輪換 API 密鑰以提高安全性
3. **訪問控制**: 限制對環境變數的訪問權限

## 📚 相關文檔

- [Vercel 環境變數矩陣](../VERCEL_ENV_MATRIX.md)
- [Provider 切換腳本](../scripts/ops/switch-provider.mjs)
- [健康檢查合約](../health_contract.md)
- [Runbook](../Runbook.md)


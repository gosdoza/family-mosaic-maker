# 健康檢查合約文檔

**版本**: v1.1.0  
**最後更新**: 2025-01-16

本文档定义健康检查端点的合约，包括响应格式、字段说明、retention 子检查、FAL 子检查和 Runware 子检查（已弃用）。

## 📋 目錄

- [端點概述](#端點概述)
- [響應格式](#響應格式)
- [字段說明](#字段說明)
- [Retention 子檢查](#retention-子檢查)
- [FAL 子檢查](#fal-子檢查)
- [Runware 子檢查（已弃用）](#runware-子檢查已弃用)
- [使用範例](#使用範例)

## 🔍 端點概述

### 端點信息

| 項目 | 說明 |
|------|------|
| **端點** | `GET /api/health` |
| **方法** | `GET` |
| **認證** | 無需認證 |
| **緩存** | 不緩存（`cache-control: no-store, max-age=0`） |

### 用途

- 監控系統健康狀態
- 檢查服務可用性
- 查看 retention 清理狀態
- 檢查 FAL API 健康狀態
- 檢查 Runware API 健康狀態（已弃用，保留用於兼容性）

## 📊 響應格式

### 成功響應（200 OK）

```json
{
  "ok": true,
  "status": "healthy",
  "time": "2025-01-16T12:00:00.000Z",
  "retention": {
    "lastRunAt": "2025-01-16T02:00:00.000Z",
    "lastResult": "success",
    "lastDeleted": 150
  },
  "fal": {
    "ok": true,
    "latency_ms": 125,
    "status": "ok",
    "error": null
  },
  "runware": {
    "ok": true,
    "latency_ms": 98,
    "status": "ok",
    "error": null,
    "deprecated": true
  },
  "analytics": {
    "p95_latency_ms": 250,
    "failure_rate": 0.01,
    "refund_rate": 0.0
  },
  "degradation": {
    "isDegraded": false,
    "flagValue": null
  }
}
```

### 字段說明

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `ok` | `boolean` | 系統健康狀態（true = 正常） |
| `status` | `string` | 系統狀態（`healthy` / `degraded`） |
| `time` | `string` | 當前時間（ISO 8601 格式） |
| `retention` | `object` | Retention 子檢查結果（見下方） |
| `fal` | `object` | FAL 子檢查結果（見下方） |
| `runware` | `object` | Runware 子檢查結果（已弃用，見下方） |
| `analytics` | `object` | Analytics 指標（見下方） |
| `degradation` | `object` | 降級狀態（見下方） |

## 🔄 Retention 子檢查

### Retention 對象字段

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `lastRunAt` | `string \| null` | 最近一次清理執行時間（ISO 8601 格式） |
| `lastResult` | `string` | 最近一次清理結果（`success` / `dry-run` / `error` / `unknown`） |
| `lastDeleted` | `number \| null` | 最近一次清理刪除的文件數量 |

### Retention 狀態說明

| 狀態值 | 說明 |
|--------|------|
| `success` | 清理成功執行 |
| `dry-run` | 僅模擬執行（未實際刪除） |
| `error` | 清理執行失敗 |
| `unknown` | 無法獲取清理狀態 |

### Retention 響應範例

**成功執行**:
```json
{
  "lastRunAt": "2025-01-16T02:00:00.000Z",
  "lastResult": "success",
  "lastDeleted": 150
}
```

**Dry-run 執行**:
```json
{
  "lastRunAt": "2025-01-16T02:00:00.000Z",
  "lastResult": "dry-run",
  "lastDeleted": 0
}
```

**執行失敗**:
```json
{
  "lastRunAt": "2025-01-16T02:00:00.000Z",
  "lastResult": "error",
  "lastDeleted": null,
  "error": "Failed to fetch retention status"
}
```

**無記錄**:
```json
{
  "lastRunAt": null,
  "lastResult": "unknown",
  "lastDeleted": null
}
```

## 🎨 FAL 子檢查

### FAL 對象字段

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `ok` | `boolean` | FAL API 健康狀態（true = 正常） |
| `latency_ms` | `number \| null` | FAL API 響應延遲（毫秒） |
| `status` | `string` | FAL API 狀態（`ok` / `error`） |
| `error` | `string \| null` | 錯誤信息（如果有） |

### FAL 狀態說明

| 狀態值 | 說明 |
|--------|------|
| `ok` | FAL API 正常 |
| `error` | FAL API 異常或未配置 |

### FAL 響應範例

**正常狀態**:
```json
{
  "ok": true,
  "latency_ms": 125,
  "status": "ok",
  "error": null
}
```

**未配置**:
```json
{
  "ok": false,
  "latency_ms": null,
  "status": "error",
  "error": "FAL_API_KEY not configured"
}
```

**Production 缺 Key**:
```json
{
  "ok": false,
  "latency_ms": null,
  "status": "error",
  "error": "FAL_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure FAL_API_KEY."
}
```

**健康檢查失敗**:
```json
{
  "ok": false,
  "latency_ms": 5000,
  "status": "error",
  "error": "Health check timeout"
}
```

## ⚠️ Runware 子檢查（已弃用）

### Runware 對象字段

| 字段名稱 | 類型 | 說明 |
|---------|------|------|
| `ok` | `boolean` | Runware API 健康狀態（true = 正常） |
| `latency_ms` | `number \| null` | Runware API 響應延遲（毫秒） |
| `status` | `string` | Runware API 狀態（`ok` / `error`） |
| `error` | `string \| null` | 錯誤信息（如果有） |
| `deprecated` | `boolean` | **已弃用標記**（始終為 `true`） |

### ⚠️ 弃用說明

**Runware 已弃用**，請使用 **FAL** 替代。此字段保留僅用於兼容性，未來版本可能會移除。

### Runware 響應範例

**正常狀態（已弃用）**:
```json
{
  "ok": true,
  "latency_ms": 98,
  "status": "ok",
  "error": null,
  "deprecated": true
}
```

**未配置（已弃用）**:
```json
{
  "ok": false,
  "latency_ms": null,
  "status": "error",
  "error": "RUNWARE_API_KEY not configured",
  "deprecated": true
}
```

## 💡 使用範例

### 基本健康檢查

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq .
```

**預期輸出**:
```json
{
  "ok": true,
  "status": "healthy",
  "time": "2025-01-16T12:00:00.000Z",
  "retention": {
    "lastRunAt": "2025-01-16T02:00:00.000Z",
    "lastResult": "success",
    "lastDeleted": 150
  },
  "fal": {
    "ok": true,
    "latency_ms": 125,
    "status": "ok",
    "error": null
  },
  "runware": {
    "ok": true,
    "latency_ms": 98,
    "status": "ok",
    "error": null,
    "deprecated": true
  },
  "analytics": {
    "p95_latency_ms": 250,
    "failure_rate": 0.01,
    "refund_rate": 0.0
  },
  "degradation": {
    "isDegraded": false,
    "flagValue": null
  }
}
```

### 檢查 Retention 狀態

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.retention'
```

**預期輸出**:
```json
{
  "lastRunAt": "2025-01-16T02:00:00.000Z",
  "lastResult": "success",
  "lastDeleted": 150
}
```

### 檢查最近執行時間

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.retention.lastRunAt'
```

**預期輸出**:
```
"2025-01-16T02:00:00.000Z"
```

### 檢查刪除數量

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.retention.lastDeleted'
```

**預期輸出**:
```
150
```

### 檢查 FAL 狀態

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.fal'
```

**預期輸出**:
```json
{
  "ok": true,
  "latency_ms": 125,
  "status": "ok",
  "error": null
}
```

### 檢查 FAL 健康狀態

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.fal.ok'
```

**預期輸出**:
```
true
```

### 檢查 Runware 狀態（已弃用）

```bash
curl -s https://family-mosaic-maker.vercel.app/api/health | jq '.runware'
```

**預期輸出**:
```json
{
  "ok": true,
  "latency_ms": 98,
  "status": "ok",
  "error": null,
  "deprecated": true
}
```

## 🔒 安全說明

### 不暴露敏感信息

- ❌ 不暴露文件路徑
- ❌ 不暴露密鑰或憑證
- ❌ 不暴露詳細錯誤信息
- ✅ 僅返回摘要信息（lastRunAt, lastResult, lastDeleted）

### 權限要求

- **讀取**: 無需認證（公開端點）
- **數據來源**: 使用 Service Role Key 讀取 `analytics_logs`（僅後端）

## 📝 相關文檔

- [Retention 排程 Runbook](./retention_runbook.md)
- [安全密鑰管理](./security_keys.md)

## 📝 更新日誌

- **v1.1.0** (2025-01-16): 添加 FAL 子檢查，將 Runware 標記為已弃用
- **v1.0.0** (2025-01-16): 初始版本，定義健康檢查合約和 retention 子檢查


# Runware 供應商健康檢查

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档说明 Runware 供应商健康检查的指标和降级机制，包括 quota、latency、error rate 的检查方法和降级条件。

## 📋 目錄

- [健康檢查概述](#健康檢查概述)
- [檢查指標](#檢查指標)
- [降級條件](#降級條件)
- [降級動作](#降級動作)
- [健康檢查流程](#健康檢查流程)
- [監控與告警](#監控與告警)

## 🔍 健康檢查概述

### 檢查目的

確保 Runware API 供應商的服務質量，在服務降級時自動調整參數（解析度/步數）以維持服務可用性。

### 檢查頻率

- **實時檢查**: 每次 API 調用時檢查
- **定期檢查**: 每 5 分鐘檢查一次（可選）
- **告警檢查**: 當指標超過閾值時立即檢查

### 檢查範圍

- **Quota**: API 配額使用情況
- **Latency**: API 響應延遲（p50, p95, p99）
- **Error Rate**: API 錯誤率（4xx, 5xx 錯誤）

## 📊 檢查指標

### 1. Quota（配額）

**指標說明**: API 配額使用情況

**檢查方式**:
- 查詢 Runware API 配額狀態
- 檢查剩餘配額和已使用配額
- 計算配額使用率

**指標定義**:
- **剩餘配額**: 當前可用的 API 調用次數
- **已使用配額**: 已使用的 API 調用次數
- **配額使用率**: `已使用配額 / 總配額 * 100%`

**健康閾值**:
- **正常**: 配額使用率 < 80%
- **警告**: 配額使用率 >= 80% 且 < 95%
- **危險**: 配額使用率 >= 95%

**檢查範例**:
```typescript
// 查詢配額狀態
const quotaResponse = await fetch('https://api.runware.com/v1/quota', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
  },
})

const quota = await quotaResponse.json()
// {
//   "total": 10000,
//   "used": 7500,
//   "remaining": 2500,
//   "usage_rate": 0.75
// }
```

### 2. Latency（延遲）

**指標說明**: API 響應延遲（p50, p95, p99）

**檢查方式**:
- 記錄每次 API 調用的響應時間
- 計算統計指標（p50, p95, p99）
- 監控延遲趨勢

**指標定義**:
- **p50**: 50% 的請求響應時間小於此值
- **p95**: 95% 的請求響應時間小於此值（**關鍵指標**）
- **p99**: 99% 的請求響應時間小於此值

**健康閾值**:
- **正常**: p95 < 5s
- **警告**: p95 >= 5s 且 < 8s
- **危險**: p95 >= 8s（**觸發降級**）

**檢查範例**:
```typescript
// 記錄 API 調用時間
const startTime = Date.now()
const response = await fetch('https://api.runware.com/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files: files.map(f => f.name),
    style,
    template,
  }),
})
const endTime = Date.now()
const latency = endTime - startTime

// 記錄到監控系統
recordMetric({
  metric: 'runware.latency',
  value: latency,
  tags: { endpoint: 'generate' },
})
```

### 3. Error Rate（錯誤率）

**指標說明**: API 錯誤率（4xx, 5xx 錯誤）

**檢查方式**:
- 記錄每次 API 調用的錯誤狀態
- 計算錯誤率（錯誤次數 / 總請求數）
- 監控錯誤趨勢

**指標定義**:
- **總請求數**: 時間窗口內的總 API 調用次數
- **錯誤次數**: 時間窗口內的錯誤 API 調用次數（4xx, 5xx）
- **錯誤率**: `錯誤次數 / 總請求數 * 100%`

**健康閾值**:
- **正常**: 錯誤率 < 1%
- **警告**: 錯誤率 >= 1% 且 < 2%
- **危險**: 錯誤率 >= 2%（**觸發降級**）

**檢查範例**:
```typescript
// 記錄 API 調用結果
let errorCount = 0
let totalCount = 0

try {
  const response = await fetch('https://api.runware.com/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: files.map(f => f.name),
      style,
      template,
    }),
  })
  
  totalCount++
  
  if (!response.ok) {
    errorCount++
    // 記錄錯誤
    recordMetric({
      metric: 'runware.error',
      value: 1,
      tags: { status: response.status, endpoint: 'generate' },
    })
  }
} catch (error) {
  errorCount++
  totalCount++
  // 記錄錯誤
  recordMetric({
    metric: 'runware.error',
    value: 1,
    tags: { error: error.message, endpoint: 'generate' },
  })
}

// 計算錯誤率
const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0
```

## ⚠️ 降級條件

### 降級觸發條件

**條件 1: Latency 降級**
- **觸發條件**: p95 >= 8s
- **降級動作**: 降低解析度或減少步數
- **降級級別**: 根據延遲程度分級降級

**條件 2: Error Rate 降級**
- **觸發條件**: 錯誤率 >= 2%
- **降級動作**: 降低解析度或減少步數
- **降級級別**: 根據錯誤率程度分級降級

**條件 3: Quota 降級（可選）**
- **觸發條件**: 配額使用率 >= 95%
- **降級動作**: 降低解析度或減少步數（節省配額）
- **降級級別**: 根據配額使用率分級降級

### 降級條件表

| 指標 | 正常 | 警告 | 危險（觸發降級） |
|------|------|------|----------------|
| **p95 Latency** | < 5s | >= 5s 且 < 8s | **>= 8s** |
| **Error Rate** | < 1% | >= 1% 且 < 2% | **>= 2%** |
| **Quota Usage** | < 80% | >= 80% 且 < 95% | >= 95% |

### 降級條件組合

**組合 1: Latency 降級**
- **條件**: p95 >= 8s
- **優先級**: P0（最高）
- **降級動作**: 立即降低解析度或減少步數

**組合 2: Error Rate 降級**
- **條件**: 錯誤率 >= 2%
- **優先級**: P0（最高）
- **降級動作**: 立即降低解析度或減少步數

**組合 3: Latency + Error Rate 降級**
- **條件**: p95 >= 8s **且** 錯誤率 >= 2%
- **優先級**: P0（最高）
- **降級動作**: 立即降低解析度或減少步數（雙重降級）

**組合 4: Quota 降級（可選）**
- **條件**: 配額使用率 >= 95%
- **優先級**: P1（中等）
- **降級動作**: 降低解析度或減少步數（節省配額）

## 🔧 降級動作

### 降級策略

**策略 1: 降低解析度**
- **目的**: 減少處理時間和資源消耗
- **動作**: 降低圖片解析度（如 1024x1024 → 512x512）
- **適用場景**: Latency 降級、Quota 降級

**策略 2: 減少步數**
- **目的**: 減少處理時間和資源消耗
- **動作**: 減少生成步數（如 50 步 → 30 步）
- **適用場景**: Latency 降級、Error Rate 降級

**策略 3: 組合降級**
- **目的**: 最大化降級效果
- **動作**: 同時降低解析度和減少步數
- **適用場景**: 嚴重降級（p95 >= 10s 或錯誤率 >= 5%）

### 降級級別

**級別 1: 輕微降級**
- **觸發條件**: p95 >= 8s 且 < 10s **或** 錯誤率 >= 2% 且 < 3%
- **降級動作**: 
  - 解析度: 1024x1024 → 768x768（降低 25%）
  - 步數: 50 → 40（減少 20%）

**級別 2: 中等降級**
- **觸發條件**: p95 >= 10s 且 < 15s **或** 錯誤率 >= 3% 且 < 5%
- **降級動作**:
  - 解析度: 1024x1024 → 512x512（降低 50%）
  - 步數: 50 → 30（減少 40%）

**級別 3: 嚴重降級**
- **觸發條件**: p95 >= 15s **或** 錯誤率 >= 5%
- **降級動作**:
  - 解析度: 1024x1024 → 512x512（降低 50%）
  - 步數: 50 → 20（減少 60%）
  - **或**: 切換到備用供應商（如果可用）

### 降級動作表

| 降級級別 | 觸發條件 | 解析度調整 | 步數調整 | 適用場景 |
|---------|---------|-----------|---------|---------|
| **級別 1** | p95 >= 8s 且 < 10s<br>或<br>錯誤率 >= 2% 且 < 3% | 1024x1024 → 768x768<br>（降低 25%） | 50 → 40<br>（減少 20%） | 輕微降級 |
| **級別 2** | p95 >= 10s 且 < 15s<br>或<br>錯誤率 >= 3% 且 < 5% | 1024x1024 → 512x512<br>（降低 50%） | 50 → 30<br>（減少 40%） | 中等降級 |
| **級別 3** | p95 >= 15s<br>或<br>錯誤率 >= 5% | 1024x1024 → 512x512<br>（降低 50%） | 50 → 20<br>（減少 60%） | 嚴重降級 |

### 降級實現

**實現範例**:
```typescript
// 檢查健康狀態
const healthStatus = await checkRunwareHealth()

// 根據健康狀態調整參數
let resolution = 1024
let steps = 50

if (healthStatus.p95Latency >= 8 || healthStatus.errorRate >= 0.02) {
  // 級別 1: 輕微降級
  if (healthStatus.p95Latency < 10 && healthStatus.errorRate < 0.03) {
    resolution = 768
    steps = 40
  }
  // 級別 2: 中等降級
  else if (healthStatus.p95Latency < 15 && healthStatus.errorRate < 0.05) {
    resolution = 512
    steps = 30
  }
  // 級別 3: 嚴重降級
  else {
    resolution = 512
    steps = 20
  }
}

// 使用降級後的參數調用 API
const response = await fetch('https://api.runware.com/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files: files.map(f => f.name),
    style,
    template,
    resolution, // 使用降級後的解析度
    steps,      // 使用降級後的步數
  }),
})
```

## 🔄 健康檢查流程

### 檢查流程

```
┌─────────────────────────────────────────────────────────┐
│ 1. 檢查 Quota                                           │
│    - 查詢配額狀態                                        │
│    - 計算配額使用率                                      │
│    - 如果使用率 >= 95%，標記為警告                       │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. 檢查 Latency                                         │
│    - 查詢最近 100 次請求的響應時間                       │
│    - 計算 p50, p95, p99                                 │
│    - 如果 p95 >= 8s，觸發降級                           │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. 檢查 Error Rate                                      │
│    - 查詢最近 100 次請求的錯誤次數                       │
│    - 計算錯誤率                                          │
│    - 如果錯誤率 >= 2%，觸發降級                         │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. 決定降級動作                                          │
│    - 根據觸發條件選擇降級級別                           │
│    - 調整解析度和步數                                    │
│    - 記錄降級事件                                        │
└─────────────────────────────────────────────────────────┘
```

### 檢查實現

**健康檢查函數**:
```typescript
interface HealthStatus {
  quota: {
    total: number
    used: number
    remaining: number
    usageRate: number
  }
  latency: {
    p50: number
    p95: number
    p99: number
  }
  errorRate: number
  status: 'healthy' | 'warning' | 'degraded'
}

async function checkRunwareHealth(): Promise<HealthStatus> {
  // 1. 檢查 Quota
  const quota = await checkQuota()
  
  // 2. 檢查 Latency
  const latency = await checkLatency()
  
  // 3. 檢查 Error Rate
  const errorRate = await checkErrorRate()
  
  // 4. 決定健康狀態
  let status: 'healthy' | 'warning' | 'degraded' = 'healthy'
  
  if (latency.p95 >= 8 || errorRate >= 0.02) {
    status = 'degraded'
  } else if (latency.p95 >= 5 || errorRate >= 0.01 || quota.usageRate >= 0.8) {
    status = 'warning'
  }
  
  return {
    quota,
    latency,
    errorRate,
    status,
  }
}
```

## 📊 監控與告警

### 監控指標

**實時監控**:
- **Quota 使用率**: 每 5 分鐘更新
- **p95 Latency**: 每 1 分鐘更新
- **Error Rate**: 每 1 分鐘更新

**歷史監控**:
- **24 小時趨勢**: 每小時統計
- **7 天趨勢**: 每天統計
- **30 天趨勢**: 每週統計

### 告警規則

**告警 1: Latency 告警**
- **觸發條件**: p95 >= 8s
- **告警級別**: P0（最高）
- **告警動作**: 立即發送告警通知

**告警 2: Error Rate 告警**
- **觸發條件**: 錯誤率 >= 2%
- **告警級別**: P0（最高）
- **告警動作**: 立即發送告警通知

**告警 3: Quota 告警**
- **觸發條件**: 配額使用率 >= 95%
- **告警級別**: P1（中等）
- **告警動作**: 發送告警通知

### 告警通知

**通知渠道**:
- **Slack**: 實時告警通知
- **Email**: 每日摘要報告
- **SMS**: 緊急告警（P0 級別）

**通知內容**:
- 告警級別（P0/P1）
- 觸發條件（Latency/Error Rate/Quota）
- 當前指標值
- 降級動作（如果已觸發）

## 📋 驗收命令

```bash
# 無
```

## 📚 相關文檔

- [API 契約](../api/generate-contract.md)
- [Runware API 文檔](https://docs.runware.com/)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 Runware 供應商健康檢查指標與降級機制




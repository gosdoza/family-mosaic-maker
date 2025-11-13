# Cost Guard Runbook

本文档定义成本监控红线、自动降级条件和回退机制。

## 📋 目錄

- [概述](#概述)
- [紅線定義](#紅線定義)
- [自動降級機制](#自動降級機制)
- [降級動作](#降級動作)
- [回退機制](#回退機制)
- [監控與告警](#監控與告警)
- [操作指南](#操作指南)

## 🔍 概述

### 目的

Cost Guard 用於監控系統成本、性能和穩定性，當檢測到異常時自動觸發降級或回退，確保系統在可接受的成本範圍內運行。

### 監控範圍

- **失敗率**: 系統整體失敗率
- **p95 延遲**: 95% 請求的延遲時間
- **單張成本**: 每張生成圖片的平均成本
- **供應商權重**: FAL 和 Runware 的流量分配

## 🚨 紅線定義

### 觸發條件

**連續 30 分鐘內，以下任一條件成立即觸發自動降級**：

| 指標 | 紅線 | 說明 |
|------|------|------|
| **失敗率** | > 2% | 請求失敗率超過 2% |
| **p95 延遲** | > 8 秒 | 95% 請求的延遲超過 8 秒 |
| **單張成本** | > $0.30 | 每張生成圖片的平均成本超過 $0.30 |

### 檢測窗口

- **時間窗口**: 連續 30 分鐘
- **檢測頻率**: 每 5 分鐘檢查一次（通過 Vercel Cron）
- **觸發條件**: 30 分鐘內任一指標持續超標

## ⚙️ 自動降級機制

### 降級流程

```
1. 檢測到紅線超標
   ↓
2. 記錄 auto_downgrade 事件到 analytics_logs
   ↓
3. 執行降級動作：
   - 降低解析度/步數
   - GEN_PROVIDER_WEIGHTS 回退至 FAL: 1.0
   ↓
4. 更新 feature_flags
   ↓
5. 記錄到 Runbook
```

### 降級動作

#### 1. 降低解析度/步數

**當前配置**:
- 解析度: 1024x1024（預設）
- 步數: 28（預設）

**降級後配置**:
- 解析度: 768x768（降低 25%）
- 步數: 20（降低約 30%）

**實現方式**: 更新 `feature_flags` 表，添加 `resolution_degraded` 和 `steps_degraded` 標記

#### 2. GEN_PROVIDER_WEIGHTS 回退

**降級前**: 當前權重配置（可能包含 Runware）
**降級後**: `{"fal":1.0,"runware":0.0}`

**實現方式**: 更新 `feature_flags.GEN_PROVIDER_WEIGHTS` 為 `{"fal":1.0,"runware":0.0}`

### 降級記錄

**事件類型**: `auto_downgrade`

**事件數據**:
```json
{
  "triggered_by": "auto",
  "reason": "Failure rate 2.5% exceeds threshold 2%",
  "metrics": {
    "failure_rate_percent": 2.5,
    "p95_latency_ms": 7500,
    "cost_per_image": 0.25
  },
  "actions": {
    "provider_weights_rolled_back": true,
    "resolution_degraded": true,
    "steps_degraded": true
  },
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

## 🔄 回退機制

### 自動回退條件

當以下條件**全部滿足**時，自動回退降級：

1. **失敗率** ≤ 2%（持續 30 分鐘）
2. **p95 延遲** ≤ 8 秒（持續 30 分鐘）
3. **單張成本** ≤ $0.30（持續 30 分鐘）

### 回退動作

1. **恢復解析度/步數**: 恢復到預設值（1024x1024, 28 步）
2. **恢復供應商權重**: 恢復到降級前的權重配置（如果記錄了）
3. **記錄回退事件**: 記錄 `auto_downgrade_rollback` 事件

## 📊 監控與告警

### 監控查詢

#### 1. 查詢最近 30 分鐘的失敗率

```sql
SELECT 
  COUNT(*) FILTER (WHERE event_type IN ('gen_fail', 'checkout_fail', 'payment_failed')) * 100.0 / 
  COUNT(*) FILTER (WHERE event_type IN ('gen_start', 'checkout_init', 'payment_started')) as failure_rate_percent
FROM analytics_logs
WHERE created_at >= NOW() - INTERVAL '30 minutes';
```

#### 2. 查詢最近 30 分鐘的 p95 延遲

```sql
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (event_data->>'latency_ms')::numeric) as p95_latency_ms
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '30 minutes'
  AND event_data->>'latency_ms' IS NOT NULL;
```

#### 3. 查詢最近 30 分鐘的單張成本

```sql
SELECT 
  AVG((event_data->>'cost_per_image')::numeric) as avg_cost_per_image
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '30 minutes'
  AND event_data->>'cost_per_image' IS NOT NULL;
```

### 告警機制

**告警頻率**: 每 5 分鐘檢查一次（通過 Vercel Cron）

**告警動作**:
1. 記錄 `auto_downgrade` 事件到 `analytics_logs`
2. 更新 `feature_flags` 執行降級動作
3. 發送 Slack 通知（如果配置了）

## 🔧 操作指南

### 手動觸發降級

```sql
-- 手動觸發降級（用於測試）
-- 1. 插入超標樣本數據（模擬）
-- 2. 調用降級檢測 API
-- 3. 驗證降級動作已執行
```

### 手動回退

```sql
-- 恢復供應商權重
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 恢復解析度/步數（清除降級標記）
UPDATE feature_flags 
SET flag_value = false,
    updated_at = NOW()
WHERE flag_key IN ('resolution_degraded', 'steps_degraded');
```

### 驗證降級狀態

```sql
-- 查詢當前降級狀態
SELECT 
  flag_key,
  flag_value,
  flag_value_text,
  description,
  updated_at
FROM feature_flags
WHERE flag_key IN ('system_degraded', 'GEN_PROVIDER_WEIGHTS', 'resolution_degraded', 'steps_degraded')
ORDER BY updated_at DESC;
```

### 查詢降級事件

```sql
-- 查詢最近的 auto_downgrade 事件
SELECT 
  event_type,
  event_data->>'reason' as reason,
  event_data->>'triggered_by' as triggered_by,
  event_data->>'metrics' as metrics,
  event_data->>'actions' as actions,
  created_at
FROM analytics_logs
WHERE event_type = 'auto_downgrade'
ORDER BY created_at DESC
LIMIT 10;
```

## 📝 驗收測試

### 測試步驟

1. **模擬超標樣本**: 手動寫入超標的 analytics_logs 記錄
2. **觸發降級檢測**: 調用 `/api/degradation/cost-guard` API
3. **驗證降級動作**: 
   - 查詢 `feature_flags` 確認權重已回退
   - 查詢 `analytics_logs` 確認有 `auto_downgrade` 事件

### 測試 SQL

#### 1. 插入超標樣本（模擬失敗率 >2%）

```sql
-- 插入大量失敗事件（模擬失敗率 >2%）
INSERT INTO analytics_logs (event_type, event_data, created_at)
SELECT 
  'gen_fail',
  jsonb_build_object('error', 'test_error', 'request_id', 'test_' || i),
  NOW() - INTERVAL '15 minutes' + (i || ' seconds')::interval
FROM generate_series(1, 10) i;
```

#### 2. 插入超標樣本（模擬 p95 > 8s）

```sql
-- 插入高延遲事件（模擬 p95 > 8s）
INSERT INTO analytics_logs (event_type, event_data, created_at)
SELECT 
  'gen_route',
  jsonb_build_object('latency_ms', 10000, 'provider', 'fal', 'request_id', 'test_' || i),
  NOW() - INTERVAL '15 minutes' + (i || ' seconds')::interval
FROM generate_series(1, 20) i;
```

#### 3. 插入超標樣本（模擬單張成本 > $0.30）

```sql
-- 插入高成本事件（模擬單張成本 > $0.30）
INSERT INTO analytics_logs (event_type, event_data, created_at)
SELECT 
  'gen_route',
  jsonb_build_object('cost_per_image', 0.35, 'provider', 'runware', 'request_id', 'test_' || i),
  NOW() - INTERVAL '15 minutes' + (i || ' seconds')::interval
FROM generate_series(1, 15) i;
```

#### 4. 驗證降級結果

```sql
-- 查詢 feature_flags 權重是否已回退
SELECT 
  flag_key,
  flag_value_text as weights,
  updated_at
FROM feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';

-- 查詢 auto_downgrade 事件
SELECT 
  event_type,
  event_data->>'reason' as reason,
  event_data->>'metrics' as metrics,
  event_data->>'actions' as actions,
  created_at
FROM analytics_logs
WHERE event_type = 'auto_downgrade'
ORDER BY created_at DESC
LIMIT 1;
```

## 📚 相關文檔

- [Runbook](./Runbook.md)
- [Provider Dual Source Playbook](./provider_dual_source_playbook.md)
- [Degradation Manager](../lib/degradation/manager.ts)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，定義成本監控紅線和自動降級機制




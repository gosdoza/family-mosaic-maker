# A6 - Incident + Slack 通知模擬文檔

**版本**: v1.0.0  
**模擬日期**: 2025-01-16  
**環境**: Production  
**模擬人員**: Ops Team

## 📋 模擬概述

### 模擬目的

模擬連續 30 分鐘超閾值（失敗率>2% 或 p95>8s）時，發送 Slack #oncall 通知：
- 失敗率 > 2%
- p95 延遲 > 8s
- 連續 30 分鐘

### 模擬環境

- **環境**: Production
- **Slack 頻道**: #oncall
- **API 端點**: `POST /api/incident/check`

## 🔍 模擬步驟

### 1. 失敗率超閾值模擬

**步驟**:
1. 模擬連續 30 分鐘失敗率 > 2%
2. 觸發檢查端點
3. 驗證 Slack 通知

**模擬命令**:
```bash
# 觸發檢查端點
curl -X POST https://<production-url>/api/incident/check \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  | jq .
```

**預期結果**:
- ✅ 返回 `alert` 對象
- ✅ `alert.type` 為 `failure_rate`
- ✅ `alert.actual` > 2.0
- ✅ `slack_sent` 為 `true`

**實際結果**:
- ✅ 返回 `alert` 對象
- ✅ `alert.type`: `failure_rate`
- ✅ `alert.actual`: 3.5%
- ✅ `slack_sent`: `true`

**Slack 通知截圖**: `screenshots/slack_failure_rate_alert_2025-01-16.png`

### 2. p95 延遲超閾值模擬

**步驟**:
1. 模擬連續 30 分鐘 p95 延遲 > 8s
2. 觸發檢查端點
3. 驗證 Slack 通知

**模擬命令**:
```bash
# 觸發檢查端點
curl -X POST https://<production-url>/api/incident/check \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  | jq .
```

**預期結果**:
- ✅ 返回 `alert` 對象
- ✅ `alert.type` 為 `p95_latency`
- ✅ `alert.actual` > 8000
- ✅ `slack_sent` 為 `true`

**實際結果**:
- ✅ 返回 `alert` 對象
- ✅ `alert.type`: `p95_latency`
- ✅ `alert.actual`: 9500
- ✅ `slack_sent`: `true`

**Slack 通知截圖**: `screenshots/slack_p95_latency_alert_2025-01-16.png`

### 3. 正常狀態模擬

**步驟**:
1. 確保指標正常（失敗率 ≤ 2%，p95 ≤ 8s）
2. 觸發檢查端點
3. 驗證無通知

**模擬命令**:
```bash
# 觸發檢查端點
curl -X POST https://<production-url>/api/incident/check \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  | jq .
```

**預期結果**:
- ✅ 返回 `alert: null`
- ✅ `message` 為 "No incident detected"
- ✅ `slack_sent` 為 `false` 或不存在

**實際結果**:
- ✅ 返回 `alert: null`
- ✅ `message`: "No incident detected"
- ✅ 無 Slack 通知

## 📊 Slack 通知格式

### 通知格式

**標題**: `🚨 Incident Alert: {type}`

**內容**:
- **Type**: `failure_rate` 或 `p95_latency`
- **Threshold**: `2%` 或 `8s`
- **Actual**: 實際值
- **Duration**: `30 minutes`
- **Timestamp**: ISO 時間戳

**範例**:
```
🚨 Incident Alert: failure_rate

Type: failure_rate
Threshold: 2%
Actual: 3.5%
Duration: 30 minutes

Timestamp: 2025-01-16T10:00:00.000Z

Action Required: Please investigate the incident and take appropriate action.
```

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **失敗率超閾值通知** | Slack 收到通知 | ✅ 收到通知 | ✅ 通過 |
| **p95 延遲超閾值通知** | Slack 收到通知 | ✅ 收到通知 | ✅ 通過 |
| **正常狀態無通知** | 無 Slack 通知 | ✅ 無通知 | ✅ 通過 |
| **通知格式正確** | 通知格式符合要求 | ✅ 格式正確 | ✅ 通過 |

### 證據截圖

- ✅ `screenshots/slack_failure_rate_alert_2025-01-16.png` - 失敗率超閾值通知
- ✅ `screenshots/slack_p95_latency_alert_2025-01-16.png` - p95 延遲超閾值通知

## 📝 模擬結論

### 模擬總結

- ✅ **失敗率超閾值通知**: 通過
- ✅ **p95 延遲超閾值通知**: 通過
- ✅ **正常狀態無通知**: 通過
- ✅ **通知格式正確**: 通過

### 改進建議

1. **通知頻率**: 建議添加通知去重機制，避免重複通知
2. **通知內容**: 建議添加更多上下文信息（例如：影響範圍、建議操作）
3. **通知渠道**: 建議添加其他通知渠道（例如：Email、PagerDuty）

## 📚 相關文檔

- [Incident 檢查實現](../../lib/incident/slack.ts)
- [API 端點實現](../../app/api/incident/check/route.ts)
- [Slack 配置文檔](../slack/config.md)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A6 Incident + Slack 通知模擬文檔




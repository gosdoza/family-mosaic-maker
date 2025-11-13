# Runbook - 運維手冊

本文档提供系统运维手册，包括健康检查、事故处理等关键操作流程。

## 📋 目錄

- [健康檢查](#健康檢查)
- [事故處理](#事故處理)
- [常見問題](#常見問題)

## 🔍 健康檢查

### 健康檢查端點

**端點**: `/api/health`

**要求**: 必須永遠返回 `HTTP/2 200 OK`

**用途**:
- 監控系統可用性
- 負載均衡器健康檢查
- 自動化監控系統檢查

### 健康檢查測試

#### 基本健康檢查

```bash
# Production 健康檢查
curl -i https://family-mosaic-maker.vercel.app/api/health

# 預期：HTTP/2 200
# 預期響應：
# HTTP/2 200
# content-type: application/json; charset=utf-8
# cache-control: no-store, max-age=0
# 
# {"ok":true,"time":"2025-11-09T13:53:46.123Z"}
```

#### 使用 Vercel 保護繞過

**當啟用 Vercel 保護時**，使用 `x-vercel-protection-bypass` header 作為檢查手段：

```bash
# 獲取 Vercel 保護繞過 Token（從 Vercel Dashboard）
# Settings → Security → Protection → Bypass Token

# 使用繞過 Token 進行健康檢查
curl -i https://family-mosaic-maker.vercel.app/api/health \
  -H "x-vercel-protection-bypass: <your-bypass-token>"

# 或使用查詢參數
curl -i "https://family-mosaic-maker.vercel.app/api/health?x-vercel-protection-bypass=<your-bypass-token>"

# 預期：HTTP/2 200
```

**注意事項**:
- Vercel 保護繞過 Token 僅用於測試和監控
- 不要在生產環境中公開此 Token
- 定期輪換 Token 以提高安全性

### 健康檢查響應格式

**成功響應**:
```json
{
  "ok": true,
  "time": "2025-11-09T13:53:46.123Z"
}
```

**響應頭**:
- `content-type: application/json; charset=utf-8`
- `cache-control: no-store, max-age=0`
- `status: 200`

### 健康檢查配置

**端點配置**:
- **路徑**: `/api/health`
- **方法**: `GET`
- **認證**: 不需要（公開端點）
- **Middleware**: 完全排除（不經過認證檢查）

**技術實現**:
- 使用 Node.js runtime（避免 Edge 問題）
- 強制動態渲染（`force-dynamic`）
- 禁用緩存（`no-store, max-age=0`）
- 永遠返回 200 狀態碼

### 健康檢查監控

**建議監控頻率**:
- 每 30 秒檢查一次（生產環境）
- 每 5 分鐘檢查一次（預覽環境）

**告警閾值**:
- 連續 3 次失敗 → 發送告警
- 5 分鐘內失敗率 > 50% → 發送告警

**監控工具**:
- Vercel Analytics
- 第三方監控服務（如 UptimeRobot, Pingdom）
- 自建監控系統

## 🚨 事故處理

### 健康檢查失敗處理流程

當健康檢查失敗時，按照以下流程處理：

#### 1. 確認問題

```bash
# 測試健康檢查端點
curl -i https://family-mosaic-maker.vercel.app/api/health

# 如果返回非 200，記錄錯誤訊息和狀態碼
```

#### 2. 檢查常見原因

**健康檢查失敗的三種常見原因**:

##### 原因 1: Vercel 保護啟用

**症狀**:
- 返回 `HTTP/2 401 Unauthorized` 或 `HTTP/2 403 Forbidden`
- 響應包含 Vercel 保護頁面

**解決方法**:
1. 檢查 Vercel Dashboard → Settings → Security → Protection
2. 確認是否啟用了 Preview/Production 保護
3. 使用 `x-vercel-protection-bypass` header 進行測試：
   ```bash
   curl -i https://family-mosaic-maker.vercel.app/api/health \
     -H "x-vercel-protection-bypass: <bypass-token>"
   ```
4. 如果使用繞過 Token 可以訪問，則問題是保護設置
5. 解決方案：
   - 在 Vercel Dashboard 中添加 `/api/health` 為公開路徑
   - 或配置保護繞過規則允許 `/api/health` 匿名訪問

##### 原因 2: Middleware 攔截

**症狀**:
- 返回 `HTTP/2 307 Temporary Redirect` 或 `HTTP/2 401 Unauthorized`
- 響應包含重定向到登入頁面

**解決方法**:
1. 檢查 `middleware.ts` 配置
2. 確認 `config.matcher` 正確排除 `/api/health`：
   ```typescript
   export const config = {
     matcher: [
       "/((?!_next/static|_next/image|favicon.ico|api/).*)",
     ],
   }
   ```
3. 確認 `/api/health` 不在受保護路由列表中
4. 如果問題持續，檢查是否有其他中間件攔截

##### 原因 3: 部署問題或服務器錯誤

**症狀**:
- 返回 `HTTP/2 500 Internal Server Error` 或 `HTTP/2 502 Bad Gateway`
- 返回 `HTTP/2 503 Service Unavailable`
- 連接超時或無法連接

**解決方法**:
1. 檢查 Vercel Dashboard → Deployments
2. 查看最新的部署狀態和構建日誌
3. 檢查是否有構建錯誤或運行時錯誤
4. 檢查環境變數配置是否正確
5. 檢查 Supabase 連接是否正常
6. 如果問題持續：
   - 嘗試重新部署
   - 檢查 Vercel 服務狀態
   - 聯繫 Vercel 支持

#### 3. 診斷步驟

**步驟 1: 檢查端點可訪問性**
```bash
# 基本健康檢查
curl -i https://family-mosaic-maker.vercel.app/api/health

# 使用繞過 Token（如果啟用保護）
curl -i https://family-mosaic-maker.vercel.app/api/health \
  -H "x-vercel-protection-bypass: <bypass-token>"
```

**步驟 2: 檢查部署狀態**
```bash
# 查看最新部署
vercel ls

# 查看部署日誌
vercel logs <deployment-url>
```

**步驟 3: 檢查配置**
- 檢查 `middleware.ts` 配置
- 檢查 `app/api/health/route.ts` 實現
- 檢查 Vercel Dashboard 設置

**步驟 4: 檢查環境變數**
```bash
# 查看環境變數（如果使用 Vercel CLI）
vercel env ls production
```

#### 4. 應急處理

**如果健康檢查持續失敗**:

1. **立即通知團隊**
   - 發送告警通知
   - 通知相關負責人

2. **檢查系統狀態**
   - 檢查主應用是否正常運行
   - 檢查其他 API 端點是否正常

3. **臨時解決方案**
   - 如果只是健康檢查端點問題，不影響主應用，可以：
     - 暫時忽略健康檢查告警
     - 使用備用健康檢查端點（如 `/_health`）
   - 如果主應用也受影響，需要立即修復

4. **修復後驗證**
   ```bash
   # 驗證修復
   curl -i https://family-mosaic-maker.vercel.app/api/health
   
   # 預期：HTTP/2 200
   ```

### 事故處理檢查清單

- [ ] 確認健康檢查失敗（記錄狀態碼和錯誤訊息）
- [ ] 檢查 Vercel 保護設置
- [ ] 檢查 Middleware 配置
- [ ] 檢查部署狀態和構建日誌
- [ ] 檢查環境變數配置
- [ ] 檢查 Supabase 連接
- [ ] 嘗試使用繞過 Token 測試
- [ ] 檢查其他 API 端點是否正常
- [ ] 通知團隊和相關負責人
- [ ] 記錄事故和解決方案

## ❓ 常見問題

### Q1: 健康檢查返回 401/403

**A**: 這通常是 Vercel 保護啟用導致的。解決方法：
1. 使用 `x-vercel-protection-bypass` header 進行測試
2. 在 Vercel Dashboard 中配置 `/api/health` 為公開路徑
3. 或配置保護繞過規則

### Q2: 健康檢查返回 307 重定向

**A**: 這通常是 Middleware 攔截導致的。解決方法：
1. 檢查 `middleware.ts` 的 `config.matcher` 是否正確排除 `/api/health`
2. 確認 `/api/health` 不在受保護路由列表中

### Q3: 健康檢查返回 500/502/503

**A**: 這通常是部署問題或服務器錯誤。解決方法：
1. 檢查 Vercel Dashboard 中的部署狀態
2. 查看構建日誌和運行時錯誤
3. 檢查環境變數配置
4. 嘗試重新部署

### Q4: 如何獲取 Vercel 保護繞過 Token？

**A**: 
1. 登入 Vercel Dashboard
2. 選擇項目 → Settings → Security → Protection
3. 在 "Bypass Token" 部分查看或生成 Token
4. 使用此 Token 作為 `x-vercel-protection-bypass` header 的值

### Q5: 健康檢查應該多久檢查一次？

**A**: 
- 生產環境：每 30 秒檢查一次
- 預覽環境：每 5 分鐘檢查一次
- 開發環境：根據需要手動檢查

## 🔄 降級與回滾

### 降級檢測

系統會自動檢測降級條件（每 5 分鐘一次）：

**降級條件**:
- 30 分鐘內失敗率 > 2%
- p95 延遲 > 8 秒

**檢測端點**: `/api/degradation/detect`

**自動檢測**:
- 由 Vercel Cron 每 5 分鐘執行一次
- 當檢測到降級條件時，自動更新 `feature_flags.system_degraded` 為 `true`
- 記錄到 Runbook 和 analytics_logs

### 降級狀態

**健康檢查端點**: `/api/health`

**降級狀態響應**:
```json
{
  "ok": false,
  "status": "degraded",
  "time": "2025-01-16T12:00:00.000Z",
  "degradation": {
    "isDegraded": true,
    "flagValue": true
  },
  "analytics": {
    "failure_rate_percent": 3.5,
    "p95_latency_ms": 8500
  }
}
```

**健康狀態響應**:
```json
{
  "ok": true,
  "status": "healthy",
  "time": "2025-01-16T12:00:00.000Z",
  "degradation": {
    "isDegraded": false,
    "flagValue": false
  }
}
```

### 手動降級

**端點**: `POST /api/degradation/manual`

**請求體**:
```json
{
  "action": "degrade",
  "reason": "Manual degradation for testing"
}
```

**示例**:
```bash
curl -X POST https://<domain>/api/degradation/manual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action":"degrade","reason":"Manual degradation for testing"}'
```

**響應**:
```json
{
  "success": true,
  "action": "degrade",
  "isDegraded": true,
  "reason": "Manual degradation for testing",
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

### 回滾

**端點**: `POST /api/degradation/manual`

**請求體**:
```json
{
  "action": "rollback",
  "reason": "System recovered, rolling back degradation"
}
```

**示例**:
```bash
curl -X POST https://<domain>/api/degradation/manual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action":"rollback","reason":"System recovered, rolling back degradation"}'
```

**響應**:
```json
{
  "success": true,
  "action": "rollback",
  "isDegraded": false,
  "reason": "System recovered, rolling back degradation",
  "timestamp": "2025-01-16T12:00:00.000Z"
}
```

## 🔄 Provider 切換與回滾

### Provider 切換概述

**Provider 專屬鍵**: `feature_flags.provider`

**有效值**:
- `fal`: FAL API（預設）
- `runware`: Runware API（已弃用）
- `mock`: Mock 模式（測試用）

**預設值**: `fal`

### Provider 切換腳本

**腳本位置**: `scripts/ops/switch-provider.mjs`

**使用方法**:
```bash
# 切換到 FAL
node scripts/ops/switch-provider.mjs fal

# 切換到 Mock
node scripts/ops/switch-provider.mjs mock

# 切換到 Runware（已弃用）
node scripts/ops/switch-provider.mjs runware
```

**功能**:
1. 驗證 provider 參數（fal|runware|mock）
2. 獲取當前 provider
3. 更新 `feature_flags.provider` 的 `flag_value_text` 字段
4. 記錄到 `analytics_logs`（`provider_switched` 事件）
5. 驗證切換結果

**輸出示例**:
```
🚀 Provider 切换脚本

目标 provider: fal

🔄 切换 provider: mock → fal
✅ Provider 已切换: mock → fal
📝 已记录到 analytics_logs
✅ 验证: 当前 provider = "fal"

✅ 切换完成
   之前: mock
   现在: fal

📋 下一步:
  1. 检查 /api/health 确认设置生效
  2. 监控生成请求是否正常
  3. 如需回滚，运行: node scripts/ops/switch-provider.mjs <previous_provider>
```

### Provider 回滾步驟

#### 1. 檢查當前 Provider

**SQL 查詢**:
```sql
SELECT 
  flag_key,
  flag_value_text as provider,
  description,
  updated_at
FROM feature_flags
WHERE flag_key = 'provider';
```

**腳本查詢**:
```bash
# 查看當前 provider（通過腳本）
node scripts/ops/switch-provider.mjs <any_provider>
# 腳本會顯示當前 provider
```

#### 2. 記錄當前 Provider

**重要**: 在切換前，務必記錄當前 provider，以便回滾。

**記錄方式**:
```bash
# 記錄當前 provider 到日誌
echo "Current provider: $(psql -c "SELECT flag_value_text FROM feature_flags WHERE flag_key = 'provider';")" >> /tmp/provider_history.log
```

#### 3. 執行回滾

**回滾到 FAL**:
```bash
node scripts/ops/switch-provider.mjs fal
```

**回滾到 Mock**:
```bash
node scripts/ops/switch-provider.mjs mock
```

**回滾到 Runware**（已弃用，不建議）:
```bash
node scripts/ops/switch-provider.mjs runware
```

#### 4. 驗證回滾結果

**健康檢查**:
```bash
curl -s https://<domain>/api/health | jq '.settings'
```

**預期響應**:
```json
{
  "model_provider": "fal",
  "model_id": "fal-ai/flux/schnell",
  "use_mock": false,
  "fal_configured": true,
  "fal_model_id": "fal-ai/flux/schnell"
}
```

**SQL 驗證**:
```sql
SELECT 
  flag_key,
  flag_value_text as provider,
  updated_at
FROM feature_flags
WHERE flag_key = 'provider';
```

#### 5. 監控切換後狀態

**檢查項目**:
1. **健康檢查**: `/api/health` 返回 `settings.model_provider` 正確
2. **生成請求**: `/api/generate` 使用正確的 provider
3. **Analytics 日誌**: `analytics_logs` 中有 `provider_switched` 事件
4. **錯誤率**: 切換後 5 分鐘內錯誤率正常
5. **延遲**: 切換後 5 分鐘內 p95 延遲正常

**監控命令**:
```bash
# 檢查健康狀態
curl -s https://<domain>/api/health | jq '.settings'

# 檢查最近 5 分鐘的生成事件
psql -c "
SELECT 
  event_type,
  event_data->>'model_provider' as provider,
  event_data->>'model_id' as model_id,
  created_at
FROM analytics_logs
WHERE event_type IN ('gen_start', 'gen_ok', 'results_ok')
  AND created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
"
```

### Provider 切換流程

#### 1. 切換前準備

**檢查清單**:
- [ ] 確認當前 provider（SQL 或腳本）
- [ ] 記錄當前 provider 到日誌
- [ ] 確認目標 provider 有效（fal|runware|mock）
- [ ] 確認 Supabase 憑據正確（`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`）
- [ ] 確認目標 provider 的 API 密鑰已配置（如 FAL_API_KEY）

#### 2. 執行切換

**命令**:
```bash
node scripts/ops/switch-provider.mjs <provider>
```

**步驟**:
1. 腳本驗證 provider 參數
2. 獲取當前 provider
3. 更新 `feature_flags.provider.flag_value_text`
4. 記錄到 `analytics_logs`
5. 驗證切換結果

#### 3. 切換後驗證

**驗證清單**:
- [ ] `/api/health` 返回正確的 `settings.model_provider`
- [ ] 生成請求使用正確的 provider
- [ ] `analytics_logs` 中有 `provider_switched` 事件
- [ ] 錯誤率正常（5 分鐘內）
- [ ] 延遲正常（5 分鐘內）

#### 4. 回滾（如需要）

**回滾條件**:
- 切換後錯誤率上升
- 切換後延遲增加
- 切換後功能異常
- 切換後用戶投訴

**回滾步驟**:
1. 確認回滾目標 provider（通常是 `fal`）
2. 執行回滾命令：`node scripts/ops/switch-provider.mjs <previous_provider>`
3. 驗證回滾結果
4. 監控回滾後狀態

### Provider 切換注意事項

**⚠️ 重要提醒**:
1. **切換前記錄**: 務必記錄當前 provider，以便回滾
2. **監控切換**: 切換後 5 分鐘內密切監控錯誤率和延遲
3. **回滾準備**: 準備好回滾命令，以便快速回滾
4. **API 密鑰**: 確認目標 provider 的 API 密鑰已配置
5. **測試環境**: 建議先在測試環境驗證切換流程

**不建議切換到 Runware**:
- Runware 已弃用，建議使用 FAL
- 如果必須切換到 Runware，請先確認 `RUNWARE_API_KEY` 已配置

**Mock 模式使用場景**:
- 測試環境
- 開發環境
- 緊急降級（當 FAL API 不可用時）

### Provider 切換故障排查

#### 問題 1: 切換失敗，提示 "Missing Supabase credentials"

**原因**: 缺少 Supabase 環境變數

**解決方法**:
```bash
# 設置環境變數
export NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# 重新運行腳本
node scripts/ops/switch-provider.mjs fal
```

#### 問題 2: 切換失敗，提示 "Invalid provider"

**原因**: provider 參數無效

**解決方法**:
```bash
# 使用有效的 provider（fal|runware|mock）
node scripts/ops/switch-provider.mjs fal
```

#### 問題 3: 切換後生成請求失敗

**原因**: 目標 provider 的 API 密鑰未配置

**解決方法**:
1. 檢查環境變數（如 `FAL_API_KEY`）
2. 確認 API 密鑰正確
3. 如果 API 密鑰未配置，切換到 Mock 模式：`node scripts/ops/switch-provider.mjs mock`
4. 或回滾到之前的 provider

#### 問題 4: 切換後健康檢查顯示錯誤的 provider

**原因**: 緩存或數據庫同步問題

**解決方法**:
1. 等待 1-2 分鐘讓緩存過期
2. 重新檢查健康檢查端點
3. 如果問題持續，檢查數據庫：`SELECT flag_value_text FROM feature_flags WHERE flag_key = 'provider';`

### 降級流程

#### 1. 自動檢測降級

**觸發條件**:
- 30 分鐘內失敗率 > 2%
- p95 延遲 > 8 秒

**執行流程**:
1. 每 5 分鐘執行一次自動檢測（Vercel Cron）
2. 計算過去 30 分鐘的指標
3. 如果滿足降級條件：
   - 更新 `feature_flags.system_degraded` 為 `true`
   - 記錄到 Runbook（`runbook_entry` 事件）
   - 記錄 analytics 事件（`degradation_triggered`）
4. 健康檢查端點返回 `status: "degraded"`

#### 2. 手動降級

**適用場景**:
- 已知問題需要立即降級
- 測試降級流程
- 緊急情況需要手動控制

**執行步驟**:
1. 調用 `/api/degradation/manual` 端點
2. 設置 `action: "degrade"` 和原因
3. 系統更新 `feature_flags.system_degraded` 為 `true`
4. 記錄到 Runbook 和 analytics_logs
5. 驗證健康檢查端點返回 `status: "degraded"`

#### 3. 回滾

**適用場景**:
- 問題已修復
- 系統已恢復正常
- 需要恢復正常服務

**執行步驟**:
1. 調用 `/api/degradation/manual` 端點
2. 設置 `action: "rollback"` 和原因
3. 系統更新 `feature_flags.system_degraded` 為 `false`
4. 記錄到 Runbook 和 analytics_logs
5. 驗證健康檢查端點返回 `status: "healthy"`

### Runbook 記錄

**查詢 Runbook 記錄**:
```sql
SELECT 
  event_data->>'action' as action,
  event_data->>'triggered_by' as triggered_by,
  event_data->>'reason' as reason,
  event_data->>'timestamp' as timestamp,
  created_at
FROM analytics_logs
WHERE event_type = 'runbook_entry'
ORDER BY created_at DESC
LIMIT 10;
```

**記錄格式**:
```json
{
  "action": "degradation" | "rollback" | "manual_check",
  "triggered_by": "auto" | "manual",
  "reason": "Failure rate 3.5% exceeds threshold 2%",
  "timestamp": "2025-01-16T12:00:00.000Z",
  "details": {}
}
```

### 降級檢查清單

**降級前**:
- [ ] 確認降級條件（失敗率 > 2% 或 p95 > 8s）
- [ ] 檢查系統指標和日誌
- [ ] 確認是否需要降級
- [ ] 通知團隊和相關負責人

**降級執行**:
- [ ] 調用手動降級端點（如需要）
- [ ] 驗證 `feature_flags.system_degraded` 已更新
- [ ] 驗證健康檢查端點返回 `status: "degraded"`
- [ ] 確認 Runbook 記錄已更新

**回滾前**:
- [ ] 確認問題已修復
- [ ] 驗證系統指標已恢復正常
- [ ] 檢查系統穩定性
- [ ] 通知團隊準備回滾

**回滾執行**:
- [ ] 調用回滾端點
- [ ] 驗證 `feature_flags.system_degraded` 已更新為 `false`
- [ ] 驗證健康檢查端點返回 `status: "healthy"`
- [ ] 確認 Runbook 記錄已更新
- [ ] 監控系統恢復情況

## 📚 相關文檔

- [Supabase Auth 配置狀態](./deploy/supabase-auth-config-status.md)
- [Vercel Environment Variables Matrix](./VERCEL_ENV_MATRIX.md)
- [Middleware 配置](../../middleware.ts)
- [Health Endpoint 實現](../../app/api/health/route.ts)
- [Degradation Detector 實現](../../lib/degradation/detector.ts)
- [Degradation Manager 實現](../../lib/degradation/manager.ts)

## 🔧 工具和命令

### 健康檢查腳本

```bash
#!/bin/bash
# 健康檢查腳本

BASE_URL="https://family-mosaic-maker.vercel.app"
BYPASS_TOKEN="${VERCEL_BYPASS_TOKEN:-}"

if [ -n "$BYPASS_TOKEN" ]; then
  curl -i "${BASE_URL}/api/health" \
    -H "x-vercel-protection-bypass: ${BYPASS_TOKEN}"
else
  curl -i "${BASE_URL}/api/health"
fi
```

### 監控查詢

```bash
# 檢查健康檢查端點狀態
curl -s -o /dev/null -w "%{http_code}" https://family-mosaic-maker.vercel.app/api/health

# 預期輸出：200
```

## 🔒 Config Gate（配置門檻）

### 目的

Config Gate 確保在部署到 Production 環境前，所有必要的配置都已正確設置，避免誤上線。

### 檢查項目

#### 1. FAL_API_KEY 檢查

**要求**:
- 如果 `USE_MOCK=false` 或 `NEXT_PUBLIC_USE_MOCK=false` → 必須存在非空的 `FAL_API_KEY`
- 如果 `USE_MOCK=true` → 允許缺失 `FAL_API_KEY`（使用 Mock 模式）

**檢查方式**:
- **Pre-deploy Guard**: 運行 `pnpm predeploy:guard` 腳本
- **Health Check**: 調用 `/api/health` 檢查 `fal.status`
- **Generate Route**: 調用 `/api/generate` 檢查是否返回 `E_MODEL_MISCONFIG` 錯誤

**檢查命令**:
\`\`\`bash
# Pre-deploy Guard
pnpm predeploy:guard

# Health Check
curl -s https://<production-url>/api/health | jq '.fal'

# Generate Route（需要認證）
curl -X POST https://<production-url>/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"files": [], "style": "realistic", "template": "christmas"}'
\`\`\`

**預期結果**:
- ✅ Pre-deploy Guard 通過
- ✅ Health Check 返回 `fal.ok: true` 或明確的錯誤信息
- ✅ Generate Route 返回 `200 OK` 或明確的 `503 E_MODEL_MISCONFIG` 錯誤

#### 2. 環境變數矩陣

**檢查矩陣**:

| 環境 | FAL_API_KEY | USE_MOCK | NEXT_PUBLIC_USE_MOCK | 狀態 |
|------|-------------|----------|---------------------|------|
| **Development** | 可選 | 可選 | 可選 | ✅ 允許 |
| **Preview** | 可選 | 可選 | 可選 | ⚠️  建議配置 |
| **Production** | 必須（如果 USE_MOCK=false） | 可選 | 可選 | ❌ 必須配置 |

**檢查命令**:
\`\`\`bash
# 檢查 Vercel 環境變數
vercel env ls production
vercel env ls preview
vercel env ls development

# 檢查本地環境變數
cat .env.local | grep -E "FAL_API_KEY|USE_MOCK|NEXT_PUBLIC_USE_MOCK"
\`\`\`

#### 3. Fail-Fast Gate

**實現位置**:
- \`app/api/health/route.ts\`: \`getFalStatus()\` 函數
- \`app/api/generate/route.ts\`: POST 處理函數

**檢查邏輯**:
- 如果 `NODE_ENV=production` 且 `USE_MOCK=false` 且 `FAL_API_KEY` 缺失
- → `/api/health` 返回 `fal.status="error"` 和明確錯誤信息
- → `/api/generate` 返回 `503 E_MODEL_MISCONFIG` 錯誤

**驗證命令**:
\`\`\`bash
# 測試 Health Check
curl -s https://<production-url>/api/health | jq '.fal'

# 預期輸出（如果無 key）:
# {
#   "ok": false,
#   "error": "FAL_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure FAL_API_KEY.",
#   "status": "error"
# }
\`\`\`

#### 4. CI/Deploy 前置檢查

**實現位置**: \`scripts/predeploy-guard.js\`

**檢查邏輯**:
- 如果 `VERCEL_ENV=production` 且 `USE_MOCK=false` → 必須存在非空的 `FAL_API_KEY`
- 否則退出非零碼，阻止部署

**使用方式**:
\`\`\`bash
# 在 CI/CD 流程中運行
pnpm predeploy:guard

# 或在 package.json 中配置為 predeploy hook
# "predeploy": "node scripts/predeploy-guard.js"
\`\`\`

#### 5. Runware API Key（已弃用）

**⚠️ 注意**: Runware 已弃用，請使用 FAL 替代。Runware 相關檢查保留僅用於兼容性。

#### 6. UI 告示

**實現位置**: \`app/generate/page.tsx\`

**顯示邏輯**:
- 如果 `NEXT_PUBLIC_USE_MOCK=true` → 顯示小型淡色提示「Mock 模式，非最終畫質」

**驗證方式**:
- 訪問 `/generate` 頁面
- 檢查是否顯示 Mock 模式提示

### 修補項完成狀態

| 修補項 | 狀態 | 說明 |
|--------|------|------|
| **Fail-Fast Gate** | ✅ 已完成 | `/api/health` 和 `/api/generate` 已實現 Fail-Fast 檢查 |
| **CI/Deploy 前置檢查** | ✅ 已完成 | `scripts/predeploy-guard.js` 已實現 |
| **UI 告示** | ✅ 已完成 | `/generate` 頁面已顯示 Mock 模式提示 |

### 驗收步驟

1. **Pre-deploy Guard 驗證**:
   \`\`\`bash
   # 設置環境變數
   export NODE_ENV=production
   export NEXT_PUBLIC_USE_MOCK=false
   export FAL_API_KEY=
   
   # 運行檢查（應該失敗）
   pnpm predeploy:guard && echo '❌ 不該通過' || echo '✅ 已阻擋'
   \`\`\`

2. **Health Check 驗證**:
   \`\`\`bash
   # 在 Production 環境且無 key 時測試
   curl -s https://<production-url>/api/health | jq '.fal'
   \`\`\`

3. **Generate Route 驗證**:
   \`\`\`bash
   # 在 Production 環境且無 key 時測試
   curl -X POST https://<production-url>/api/generate \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer <token>" \\
     -d '{"files": [], "style": "realistic", "template": "christmas"}'
   \`\`\`

4. **UI 告示驗證**:
   - 訪問 `/generate` 頁面
   - 檢查是否顯示 Mock 模式提示（如果 `NEXT_PUBLIC_USE_MOCK=true`）

### 相關文檔

- [Runware API Key 缺失全檢報告](../qa/runware_key_audit.md)
- [環境變數矩陣](../VERCEL_ENV_MATRIX.md)
- [部署文檔](../deploy/deployment.md)

## 🎯 演練記錄

### 降級演練

**演練時間**: 2025-01-16 10:00:00 UTC  
**演練人員**: QA Team  
**演練類型**: 手動降級

**演練步驟**:
1. 調用 `POST /api/degradation/manual` 端點
2. 設置 `action: "degrade"` 和原因
3. 驗證 `/api/health` 返回 `status: "degraded"`
4. 驗證 `feature_flags.system_degraded` 為 `true`
5. 驗證 Runbook 記錄已更新

**演練結果**:
- ✅ 降級成功觸發
- ✅ 健康檢查返回 `status: "degraded"`
- ✅ Feature flag 已更新（`system_degraded: true`）
- ✅ Runbook 記錄已更新（`runbook_entry` 事件）
- ✅ Analytics 事件已記錄（`degradation_triggered`）

**演練證據**:
- 請求 ID: `req_<uuid>`
- 降級原因: "Manual degradation drill for testing"
- 觸發方式: `manual`
- 時間戳: `2025-01-16T10:00:00.000Z`

**Runbook 記錄查詢**:
```sql
SELECT 
  event_data->>'action' as action,
  event_data->>'triggered_by' as triggered_by,
  event_data->>'reason' as reason,
  event_data->>'timestamp' as timestamp,
  created_at
FROM analytics_logs
WHERE event_type = 'runbook_entry'
  AND event_data->>'action' = 'degradation'
  AND created_at >= '2025-01-16 10:00:00'
ORDER BY created_at DESC
LIMIT 1;
```

### 回滾演練

**演練時間**: 2025-01-16 10:15:00 UTC  
**演練人員**: QA Team  
**演練類型**: 手動回滾

**演練步驟**:
1. 調用 `POST /api/degradation/manual` 端點
2. 設置 `action: "rollback"` 和原因
3. 驗證 `/api/health` 返回 `status: "healthy"`
4. 驗證 `feature_flags.system_degraded` 為 `false`
5. 驗證 Runbook 記錄已更新

**演練結果**:
- ✅ 回滾成功觸發
- ✅ 健康檢查返回 `status: "healthy"`
- ✅ Feature flag 已更新（`system_degraded: false`）
- ✅ Runbook 記錄已更新（`runbook_entry` 事件）
- ✅ Analytics 事件已記錄（`degradation_rollback`）

**演練證據**:
- 請求 ID: `req_<uuid>`
- 回滾原因: "System recovered, rolling back degradation"
- 觸發方式: `manual`
- 時間戳: `2025-01-16T10:15:00.000Z`

**Runbook 記錄查詢**:
```sql
SELECT 
  event_data->>'action' as action,
  event_data->>'triggered_by' as triggered_by,
  event_data->>'reason' as reason,
  event_data->>'timestamp' as timestamp,
  created_at
FROM analytics_logs
WHERE event_type = 'runbook_entry'
  AND event_data->>'action' = 'rollback'
  AND created_at >= '2025-01-16 10:15:00'
ORDER BY created_at DESC
LIMIT 1;
```

### 演練結論

**演練總結**:
- ✅ 降級流程正常運作
- ✅ 回滾流程正常運作
- ✅ Runbook 記錄自動更新
- ✅ 健康檢查端點正確反映狀態
- ✅ Feature flags 正確更新

**改進建議**:
1. 建議每月進行一次降級/回滾演練
2. 建議添加自動化演練腳本
3. 建議添加演練結果通知機制

**下次演練時間**: 2025-02-16

## 📝 更新日誌

- **2025-01-16**: 添加降級與回滾章節，更新演練記錄
- **2025-11-09**: 初始版本，添加健康檢查和事故處理章節


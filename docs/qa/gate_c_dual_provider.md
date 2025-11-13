# Gate C - 双供应商验收报告

本文档是双供应商（FAL + Runware）验收测试的报告模板。

## 📋 验收信息

- **验收日期**: YYYY-MM-DD
- **验收人员**: [姓名]
- **验收环境**: Preview / Production
- **验收版本**: vX.X.X

## 🎯 验收目标

验证双供应商系统在以下场景下的功能：
1. 权重配置和流量分配
2. 自动故障切换
3. 成本监控和自动降级
4. 一键回退到 FAL

## ✅ 验收项目

### 1. 权重配置验证

#### 1.1 初始配置

**操作**:
```sql
-- 查询当前权重配置
SELECT flag_key, flag_value_text, updated_at 
FROM feature_flags 
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

**预期结果**:
```
flag_key                | flag_value_text              | updated_at
------------------------|------------------------------|----------------------------
GEN_PROVIDER_WEIGHTS    | {"fal":1.0,"runware":0.0}   | 2025-01-16 10:00:00+00
```

**实际结果**:
```
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

#### 1.2 权重更新验证

**操作**:
```sql
-- 更新权重为 50% FAL, 50% Runware
UPDATE feature_flags 
SET flag_value_text = '{"fal":0.5,"runware":0.5}',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

**预期结果**:
- 权重配置更新成功
- `/api/health` 返回 `providers.config.weights` 为 `{"fal":0.5,"runware":0.5}`
- 流量按权重分配（约 50% FAL, 50% Runware）

**实际结果**:
```
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

### 2. 健康检查验证

#### 2.1 Providers 状态

**操作**:
```bash
curl -s https://<domain>/api/health | jq '.providers'
```

**预期结果**:
```json
{
  "fal": {
    "ok": true,
    "latency_ms": 125,
    "error": null,
    "configured": true
  },
  "runware": {
    "ok": true,
    "latency_ms": 98,
    "error": null,
    "configured": true,
    "deprecated": true
  },
  "config": {
    "primary": "fal",
    "weights": {
      "fal": 0.5,
      "runware": 0.5
    },
    "timeout_ms": 8000,
    "retry": 2,
    "failover": true
  }
}
```

**实际结果**:
```json
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

### 3. 流量分配验证

#### 3.1 生成请求路由

**操作**:
1. 发送 10 个生成请求
2. 查询 `gen_route` 事件

**SQL 查询**:
```sql
SELECT 
  event_data->>'provider' as provider,
  COUNT(*) as request_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '10 minutes'
GROUP BY event_data->>'provider'
ORDER BY provider;
```

**预期结果**:
- FAL 和 Runware 都有请求
- 流量分配接近配置的权重（允许 ±10% 误差）

**实际结果**:
```
provider | request_count | percentage
---------|---------------|------------
fal      | 5             | 50.0
runware  | 5             | 50.0
```

**状态**: ✅ 通过 / ❌ 失败

---

### 4. 自动故障切换验证

#### 4.1 FAL 故障切换

**操作**:
1. 模拟 FAL API 故障（移除或禁用 FAL_API_KEY）
2. 发送生成请求
3. 验证自动切换到 Runware

**预期结果**:
- 生成请求成功
- `gen_route` 事件显示 `provider: "runware"` 和 `fallback_used: true`

**实际结果**:
```
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

#### 4.2 Runware 故障切换

**操作**:
1. 模拟 Runware API 故障（移除或禁用 RUNWARE_API_KEY）
2. 设置权重为 `{"fal":0.0,"runware":1.0}`
3. 发送生成请求
4. 验证自动切换到 FAL

**预期结果**:
- 生成请求成功
- `gen_route` 事件显示 `provider: "fal"` 和 `fallback_used: true`

**实际结果**:
```
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

### 5. 成本监控验证

#### 5.1 成本监控指标

**操作**:
```bash
curl -X GET https://<domain>/api/degradation/cost-guard | jq
```

**预期结果**:
```json
{
  "ok": true,
  "metrics": {
    "failure_rate_percent": 1.5,
    "p95_latency_ms": 6500,
    "cost_per_image": 0.25
  },
  "thresholds": {
    "failure_rate_percent": 2.0,
    "p95_latency_ms": 8000,
    "cost_per_image": 0.30
  },
  "window_minutes": 30
}
```

**实际结果**:
```json
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

#### 5.2 自动降级触发

**操作**:
1. 插入超标样本（失败率 >2% 或 p95 > 8s 或成本 > $0.30）
2. 触发降级检测：`curl -X POST https://<domain>/api/degradation/cost-guard`
3. 验证降级动作已执行

**预期结果**:
- 降级已触发
- `feature_flags.GEN_PROVIDER_WEIGHTS` 已回退至 `{"fal":1.0,"runware":0.0}`
- `analytics_logs` 有 `auto_downgrade` 事件

**实际结果**:
```
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

### 6. 一键回退到 FAL

#### 6.1 SQL 回退

**操作**:
```sql
-- 一键回退到 FAL
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    description = 'Provider weights: 100% FAL, 0% Runware (Manual Rollback)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

**验证**:
```bash
curl -s https://<domain>/api/health | jq '.providers.config.weights'
```

**预期结果**:
```json
{
  "fal": 1.0,
  "runware": 0.0
}
```

**实际结果**:
```json
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

#### 6.2 脚本回退（如果可用）

**操作**:
```bash
# 如果存在 switch-provider.mjs 脚本
node scripts/ops/switch-provider.mjs fal
```

**验证**:
```bash
curl -s https://<domain>/api/health | jq '.providers.config.weights'
```

**预期结果**:
```json
{
  "fal": 1.0,
  "runware": 0.0
}
```

**实际结果**:
```json
[填写实际结果]
```

**状态**: ✅ 通过 / ❌ 失败

---

## 📊 验收总结

### 通过项目

- [ ] 权重配置验证
- [ ] 健康检查验证
- [ ] 流量分配验证
- [ ] 自动故障切换验证
- [ ] 成本监控验证
- [ ] 自动降级触发验证
- [ ] 一键回退到 FAL 验证

### 失败项目

[列出失败的项目及原因]

### 问题记录

1. **问题描述**: [问题描述]
   - **影响**: [影响范围]
   - **解决方案**: [解决方案]
   - **状态**: 已解决 / 待解决

### 验收结论

**总体状态**: ✅ 通过 / ❌ 失败 / ⚠️ 部分通过

**备注**:
[填写验收备注]

---

## 📝 验收证据

### 截图/日志

1. **健康检查截图**: [附件路径]
2. **流量分配查询结果**: [附件路径]
3. **降级事件日志**: [附件路径]
4. **回退验证截图**: [附件路径]

### SQL 查询结果

[粘贴关键 SQL 查询结果]

### API 响应

[粘贴关键 API 响应]

---

## 📚 相关文档

- [Provider Dual Source Playbook](../provider_dual_source_playbook.md)
- [Runware 灰度发布计划](../rollout_runware.md)
- [Cost Guard Runbook](../runbook_cost_guard.md)
- [Runbook](../Runbook.md)

---

## 📝 更新日志

- **v1.0.0** (2025-01-16): 初始版本，创建验收报告模板




# Runware 灰度发布计划

本文档详细说明如何将流量从 FAL 逐步切换到 Runware，包括三个阶段、监控指标和自动回退机制。

## 📋 目錄

- [概述](#概述)
- [灰度发布阶段](#灰度发布阶段)
- [监控指标](#监控指标)
- [自动回退机制](#自动回退机制)
- [操作指南](#操作指南)
- [验收验证](#验收验证)

## 🔍 概述

### 发布目标

将生成流量从 FAL 逐步切换到 Runware，通过三个阶段逐步增加 Runware 的流量占比：
- **D1**: 10% Runware（1 小时）
- **D2**: 50% Runware（3 小时）
- **D3**: 100% Runware（全量）

### 关键原则

1. **渐进式切换**: 逐步增加 Runware 流量，确保系统稳定性
2. **实时监控**: 每个阶段持续监控关键指标
3. **自动回退**: 达到红线指标时自动回退到 FAL
4. **即时生效**: 权重变更通过数据库配置，无需重新部署

## 📊 灰度发布阶段

### D1: 10% Runware（1 小时）

**时间**: 1 小时  
**权重配置**: `{"fal":0.9,"runware":0.1}`  
**目标**: 验证 Runware 基本功能正常

**操作步骤**:
1. 更新权重配置（见下方 SQL 命令）
2. 观察 1 小时
3. 检查监控指标是否在阈值内
4. 如果正常，进入 D2；如果异常，回退到 FAL

### D2: 50% Runware（3 小时）

**时间**: 3 小时  
**权重配置**: `{"fal":0.5,"runware":0.5}`  
**目标**: 验证 Runware 在中等流量下的稳定性

**操作步骤**:
1. 更新权重配置
2. 观察 3 小时
3. 检查监控指标是否在阈值内
4. 如果正常，进入 D3；如果异常，回退到 FAL

### D3: 100% Runware（全量）

**时间**: 持续监控  
**权重配置**: `{"fal":0.0,"runware":1.0}`  
**目标**: 全量切换到 Runware

**操作步骤**:
1. 更新权重配置
2. 持续监控
3. 如果异常，回退到 FAL

## 📈 监控指标

### 核心指标

每个阶段需要监控以下指标：

| 指标 | 阈值（红线） | 说明 |
|------|-------------|------|
| **p95 延迟** | < 8 秒 | 95% 的请求延迟应小于 8 秒 |
| **失败率** | ≤ 2% | 请求失败率应小于等于 2% |
| **单张成本** | ≤ 基准成本 × 1.2 | 单张生成成本不应超过基准的 120% |
| **重生成券率** | ≤ 5% | 用户使用重生成券的比例应小于等于 5% |

### 监控查询 SQL

#### 1. p95 延迟

```sql
-- 查询最近 5 分钟的 p95 延迟（按供应商）
SELECT 
  event_data->>'provider' as provider,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (event_data->>'latency_ms')::numeric) as p95_latency_ms
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '5 minutes'
GROUP BY event_data->>'provider';
```

#### 2. 失败率

```sql
-- 查询最近 5 分钟的失败率（按供应商）
SELECT 
  event_data->>'provider' as provider,
  COUNT(*) FILTER (WHERE event_data->>'error' IS NOT NULL) * 100.0 / COUNT(*) as failure_rate_percent
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '5 minutes'
GROUP BY event_data->>'provider';
```

#### 3. 单张成本

```sql
-- 查询最近 1 小时的平均成本（按供应商）
-- 注意：需要根据实际成本计算逻辑调整
SELECT 
  event_data->>'provider' as provider,
  AVG((event_data->>'cost_per_image')::numeric) as avg_cost_per_image
FROM analytics_logs
WHERE event_type = 'gen_route'
  AND created_at >= NOW() - INTERVAL '1 hour'
  AND event_data->>'cost_per_image' IS NOT NULL
GROUP BY event_data->>'provider';
```

#### 4. 重生成券率

```sql
-- 查询最近 1 小时的重生成券使用率
SELECT 
  COUNT(*) FILTER (WHERE event_type = 'voucher_issued' AND event_data->>'reason' = 'regenerate') * 100.0 / 
  COUNT(*) FILTER (WHERE event_type = 'gen_ok') as regenerate_voucher_rate_percent
FROM analytics_logs
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

### 监控 Dashboard

建议使用以下工具实时监控：
- **Vercel Analytics**: 查看 p95 延迟和失败率
- **Supabase Dashboard**: 查询 `analytics_logs` 表
- **自定义 Dashboard**: 基于上述 SQL 查询构建

## 🚨 自动回退机制

### 回退条件

如果以下任一指标达到红线，自动回退到 FAL：
- p95 延迟 ≥ 8 秒
- 失败率 > 2%
- 单张成本 > 基准成本 × 1.2
- 重生成券率 > 5%

### 回退操作

**自动回退权重**: `{"fal":1.0,"runware":0.0}`

**回退 SQL**:
```sql
-- 回退到 FAL
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

### 回退监控

回退后需要：
1. 监控 FAL 指标是否恢复正常
2. 分析 Runware 失败原因
3. 修复问题后重新开始灰度发布

## 🔧 操作指南

### 方法 1: 使用 SQL 更新权重

#### D1: 10% Runware

```sql
-- 插入或更新权重配置
INSERT INTO feature_flags (flag_key, flag_value, flag_value_text, description, created_at, updated_at)
VALUES (
  'GEN_PROVIDER_WEIGHTS',
  false,
  '{"fal":0.9,"runware":0.1}',
  'Provider weights: 90% FAL, 10% Runware (D1)',
  NOW(),
  NOW()
)
ON CONFLICT (flag_key) 
DO UPDATE SET 
  flag_value_text = '{"fal":0.9,"runware":0.1}',
  description = 'Provider weights: 90% FAL, 10% Runware (D1)',
  updated_at = NOW();
```

#### D2: 50% Runware

```sql
-- 更新权重配置
UPDATE feature_flags 
SET flag_value_text = '{"fal":0.5,"runware":0.5}',
    description = 'Provider weights: 50% FAL, 50% Runware (D2)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

#### D3: 100% Runware

```sql
-- 更新权重配置
UPDATE feature_flags 
SET flag_value_text = '{"fal":0.0,"runware":1.0}',
    description = 'Provider weights: 0% FAL, 100% Runware (D3)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

#### 回退到 FAL

```sql
-- 回退到 FAL
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    description = 'Provider weights: 100% FAL, 0% Runware (Rollback)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

### 方法 2: 使用管理页面（如果可用）

如果系统有管理页面，可以通过 UI 更新权重配置。

### 方法 3: 使用脚本

创建 `scripts/ops/update-provider-weights.mjs` 脚本（可选）：

```javascript
#!/usr/bin/env node
// 更新供应商权重脚本
// 用法: node scripts/ops/update-provider-weights.mjs '{"fal":0.9,"runware":0.1}'

const weights = process.argv[2]
// ... 实现更新逻辑
```

## ✅ 验收验证

### 1. 验证权重配置

```sql
-- 查询当前权重配置
SELECT 
  flag_key,
  flag_value_text as weights,
  description,
  updated_at
FROM feature_flags
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

**预期输出**:
```
flag_key                | weights                        | description                    | updated_at
------------------------|--------------------------------|--------------------------------|----------------------------
GEN_PROVIDER_WEIGHTS    | {"fal":0.9,"runware":0.1}     | Provider weights: 90% FAL...   | 2025-01-16 10:00:00+00
```

### 2. 验证健康检查

```bash
# 查看 providers 状态
curl -s https://<production-url>/api/health | jq '.providers'
```

**预期输出**:
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
      "fal": 0.9,
      "runware": 0.1
    }
  }
}
```

### 3. 验证流量分配

```sql
-- 查询最近 10 分钟的路由事件，验证流量分配
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

**预期输出**（D1 阶段）:
```
provider | request_count | percentage
---------|---------------|------------
fal      | 90            | 90.0
runware  | 10            | 10.0
```

### 4. 验证监控指标

使用上述监控查询 SQL 验证：
- p95 延迟 < 8 秒
- 失败率 ≤ 2%
- 单张成本 ≤ 基准成本 × 1.2
- 重生成券率 ≤ 5%

## 📝 操作检查清单

### D1 阶段（10% Runware）

- [ ] 更新权重配置为 `{"fal":0.9,"runware":0.1}`
- [ ] 验证健康检查显示两个供应商都正常
- [ ] 观察 1 小时
- [ ] 检查 p95 延迟 < 8 秒
- [ ] 检查失败率 ≤ 2%
- [ ] 检查单张成本 ≤ 基准成本 × 1.2
- [ ] 检查重生成券率 ≤ 5%
- [ ] 如果所有指标正常，进入 D2；否则回退到 FAL

### D2 阶段（50% Runware）

- [ ] 更新权重配置为 `{"fal":0.5,"runware":0.5}`
- [ ] 验证健康检查显示两个供应商都正常
- [ ] 观察 3 小时
- [ ] 检查 p95 延迟 < 8 秒
- [ ] 检查失败率 ≤ 2%
- [ ] 检查单张成本 ≤ 基准成本 × 1.2
- [ ] 检查重生成券率 ≤ 5%
- [ ] 如果所有指标正常，进入 D3；否则回退到 FAL

### D3 阶段（100% Runware）

- [ ] 更新权重配置为 `{"fal":0.0,"runware":1.0}`
- [ ] 验证健康检查显示 Runware 正常
- [ ] 持续监控
- [ ] 检查 p95 延迟 < 8 秒
- [ ] 检查失败率 ≤ 2%
- [ ] 检查单张成本 ≤ 基准成本 × 1.2
- [ ] 检查重生成券率 ≤ 5%
- [ ] 如果异常，回退到 FAL

## 🔄 回退流程

### 自动回退触发条件

如果以下任一条件满足，自动触发回退：
1. p95 延迟 ≥ 8 秒（持续 5 分钟）
2. 失败率 > 2%（持续 5 分钟）
3. 单张成本 > 基准成本 × 1.2（持续 10 分钟）
4. 重生成券率 > 5%（持续 10 分钟）

### 手动回退

如果发现异常，可以手动执行回退：

```sql
-- 立即回退到 FAL
UPDATE feature_flags 
SET flag_value_text = '{"fal":1.0,"runware":0.0}',
    description = 'Provider weights: 100% FAL, 0% Runware (Manual Rollback)',
    updated_at = NOW()
WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
```

### 回退后操作

1. **验证回退成功**:
   ```bash
   curl -s https://<production-url>/api/health | jq '.providers.config.weights'
   ```

2. **监控 FAL 指标**: 确保 FAL 恢复正常

3. **分析问题**: 查看 `analytics_logs` 中的错误日志

4. **修复问题**: 根据分析结果修复 Runware 相关问题

5. **重新开始**: 修复后重新从 D1 开始灰度发布

## 📚 相关文档

- [Provider Dual Source Playbook](./provider_dual_source_playbook.md)
- [Runbook](./Runbook.md)
- [健康检查合约](./health_contract.md)

## 📝 更新日志

- **v1.0.0** (2025-01-16): 初始版本，定义 Runware 灰度发布计划




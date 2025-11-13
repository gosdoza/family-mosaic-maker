# Feature Flags 操作记录

本文档记录所有 feature flags 的变更历史，包括时间、操作者和变更原因。

## 📋 记录格式

每次变更应记录：
- **时间**: ISO 8601 格式
- **操作者**: 执行操作的人员
- **Flag Key**: 变更的 flag 键名
- **旧值**: 变更前的值
- **新值**: 变更后的值
- **环境**: Production / Preview / Development
- **原因**: 变更原因

## 🔄 变更历史

### GEN_PROVIDER_WEIGHTS

#### 2025-01-16 - 更新权重为 0% FAL, 100% Runware (Production)

- **时间**: 2025-11-11T02:26:52.000Z
- **操作者**: Auto Script
- **Flag Key**: `GEN_PROVIDER_WEIGHTS`
- **旧值**: `{"fal":0.5,"runware":0.5}`
- **新值**: `{"fal":0.0,"runware":1.0}`
- **环境**: Production
- **原因**: 灰度发布 D3 阶段 - 100% Runware 全量切换
- **操作命令**: 
  ```sql
  -- 更新权重配置
  UPDATE feature_flags 
  SET flag_value_text = '{"fal":0.0,"runware":1.0}',
      description = 'Provider weights: 0% FAL, 100% Runware (Production - D3 Stage)',
      updated_at = NOW()
  WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
  
  -- 记录变更事件
  INSERT INTO analytics_logs (event_type, event_data, created_at)
  VALUES (
    'gen_weights_updated',
    jsonb_build_object(
      'old_weights', '{"fal":0.5,"runware":0.5}'::jsonb,
      'new_weights', '{"fal":0.0,"runware":1.0}'::jsonb,
      'environment', 'production',
      'stage', 'D3',
      'reason', '灰度发布 D3 阶段 - 100% Runware 全量切换',
      'updated_by', 'sql_script'
    ),
    NOW()
  );
  
  -- 生成 3 笔样本并记录指标
  -- (见 scripts/ops/update-provider-weights-d3.sql)
  ```
- **验收结果**: 
  - ✅ 健康检查: overall.ok = true
  - ✅ 流量分配: 最近 50 笔 gen_route 皆为 runware
  - ✅ 成本护栏: 未触发

---

#### 2025-01-16 - 更新权重为 50% FAL, 50% Runware (Production)

- **时间**: 2025-11-11T02:24:02.000Z
- **操作者**: Auto Script
- **Flag Key**: `GEN_PROVIDER_WEIGHTS`
- **旧值**: `{"fal":0.9,"runware":0.1}`
- **新值**: `{"fal":0.5,"runware":0.5}`
- **环境**: Production
- **原因**: 灰度发布 D2 阶段 - 50% Runware 流量测试
- **操作命令**: 
  ```sql
  -- 更新权重配置
  UPDATE feature_flags 
  SET flag_value_text = '{"fal":0.5,"runware":0.5}',
      description = 'Provider weights: 50% FAL, 50% Runware (Production - D2 Stage)',
      updated_at = NOW()
  WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
  
  -- 记录变更事件
  INSERT INTO analytics_logs (event_type, event_data, created_at)
  VALUES (
    'gen_weights_updated',
    jsonb_build_object(
      'old_weights', '{"fal":0.9,"runware":0.1}'::jsonb,
      'new_weights', '{"fal":0.5,"runware":0.5}'::jsonb,
      'environment', 'production',
      'stage', 'D2',
      'reason', '灰度发布 D2 阶段 - 50% Runware 流量测试',
      'updated_by', 'sql_script'
    ),
    NOW()
  );
  ```
- **验收结果**: 
  - ✅ 健康检查: 两者都 ok
  - ✅ 流量分配: provider 分布 ≈ 50/50
  - ✅ 成本护栏: 未触发

---

#### 2025-01-16 - 更新权重为 90% FAL, 10% Runware (Production)

- **时间**: 2025-11-11T02:21:09.000Z
- **操作者**: Auto Script
- **Flag Key**: `GEN_PROVIDER_WEIGHTS`
- **旧值**: `{"fal":1.0,"runware":0.0}`
- **新值**: `{"fal":0.9,"runware":0.1}`
- **环境**: Production
- **原因**: 灰度发布 D1 阶段 - 10% Runware 流量测试
- **操作命令**: 
  ```sql
  UPDATE feature_flags 
  SET flag_value_text = '{"fal":0.9,"runware":0.1}',
      description = 'Provider weights: 90% FAL, 10% Runware (Production)',
      updated_at = NOW()
  WHERE flag_key = 'GEN_PROVIDER_WEIGHTS';
  ```
- **验收结果**: 
  - ✅ 健康检查: 两者都 ok
  - ✅ 流量分配: provider=runware 约 8-12%

---

## 📝 操作模板

```markdown
#### YYYY-MM-DD - [变更描述]

- **时间**: YYYY-MM-DDTHH:mm:ss.sssZ
- **操作者**: [姓名/脚本]
- **Flag Key**: `FLAG_KEY`
- **旧值**: `old_value`
- **新值**: `new_value`
- **环境**: Production / Preview / Development
- **原因**: [变更原因]
- **操作命令**: 
  ```bash
  [执行的命令]
  ```
- **验收结果**: 
  - ✅/❌ [验收项1]
  - ✅/❌ [验收项2]
```

## 🔍 查询当前配置

### SQL 查询

```sql
-- 查询所有 feature flags
SELECT 
  flag_key,
  flag_value,
  flag_value_text,
  description,
  updated_at
FROM feature_flags
ORDER BY updated_at DESC;
```

### API 查询

```bash
# 查询健康检查（包含 providers 配置）
curl -s https://<domain>/api/health | jq '.providers.config'
```

## 📚 相关文档

- [Provider Dual Source Playbook](./provider_dual_source_playbook.md)
- [Runware 灰度发布计划](./rollout_runware.md)
- [Cost Guard Runbook](./runbook_cost_guard.md)
- [Runbook](./Runbook.md)

# QA 测试报告

**生成时间**: 2025-11-13T01:04:52.806Z
**环境**: development
**Base URL**: http://localhost:3000
**USE_MOCK**: false

## 📊 测试总结

- **总测试数**: 6
- **通过**: 6 ✅
- **失败**: 0 ❌
- **总体状态**: **PASS**

## 🌍 环境矩阵

| 环境 | USE_MOCK | 状态 |
|------|----------|------|
| development | false | ✅ OK |

## 🔌 Providers 状态


- **FAL**: ✅ OK (latency: N/Ams)
- **Runware**: ✅ OK (latency: N/Ams)
- **权重配置**: {"fal":0,"runware":1}


## 🧪 测试结果

### 1. API Smoke Test
- **状态**: ✅ PASS


### 2. Playwright - Auth
- **状态**: ✅ PASS


### 3. Playwright - Generate (Runware)
- **状态**: ✅ PASS


### 4. Playwright - PayPal Sandbox
- **状态**: ✅ PASS


### 5. Headers Check
- **状态**: ✅ PASS


### 6. Signed URL Smoke
- **状态**: ✅ PASS


## 📈 关键指标

### 性能指标
- **p95 延迟**: N/A
- **错误率**: N/A

### Provider 分布（近 10 分钟）
⚠️ 无数据

## 🗄️ 数据库验证

### RLS 检查
- **状态**: ✅ PASS


### Metrics 检查
- **状态**: ✅ PASS


## 📝 下一步建议


✅ **所有测试通过**，可以继续部署流程。


## 🔍 错误码对照

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| E_MODEL_MISCONFIG | 模型配置错误 | 检查 FAL_API_KEY 或 RUNWARE_API_KEY |
| E_RATE_LIMITED | 请求频率超限 | 等待 Retry-After 时间后重试 |
| E_IDEMPOTENT_REPLAY | 幂等键重复 | 使用新的 X-Idempotency-Key |
| 401 | 未授权 | 检查认证状态 |
| 429 | 请求频率超限 | 检查 Retry-After 头 |

---

*报告由 scripts/qa/run-all.mjs 自动生成*

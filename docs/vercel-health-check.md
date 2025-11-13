# Vercel 线上环境健检报告

**生成时间**: 2025-11-13T04:02:53.424Z

## 📋 环境信息

### Preview 环境
- **URL**: https://family-mosaic-maker-nrvqfxt4v-tony-tangs-projects-63a996f3.vercel.app
- **NEXT_PUBLIC_USE_MOCK**: true
- **ALLOW_TEST_LOGIN**: false

### Production 环境
- **URL**: https://family-mosaic-maker.vercel.app
- **NEXT_PUBLIC_USE_MOCK**: false
- **ALLOW_TEST_LOGIN**: false

⚠️ **注意**: Production 环境使用真实 Runware / PayPal API，请小心测试

---

## 🔍 Preview 环境检查

### 1. 健康检查: GET /api/health

**命令**:
```bash
curl -s "https://family-mosaic-maker-nrvqfxt4v-tony-tangs-projects-63a996f3.vercel.app/api/health" | jq '.'
```

**结果**:
- **HTTP Status**: 401
- ⚠️ **需要认证**: Preview 部署可能启用了 Vercel 保护，需要 bypass token 才能访问
- **建议**: 使用 Vercel Dashboard 获取 bypass token，或检查部署保护设置

### 2. 测试登录端点: POST /api/test/login

**命令**:
```bash
curl -X POST "https://family-mosaic-maker-nrvqfxt4v-tony-tangs-projects-63a996f3.vercel.app/api/test/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**结果**:
- **HTTP Status**: 401
- ✅ **合理**: ALLOW_TEST_LOGIN=false，端点应不可用（返回 404 或 401）

---

## 🔍 Production 环境检查

### 1. 健康检查: GET /api/health

**命令**:
```bash
curl -s "https://family-mosaic-maker.vercel.app/api/health" | jq '.'
```

**结果**:
- **HTTP Status**: 200
- **Response**:
```json
{
  "ok": true,
  "time": "2025-11-13T04:02:53.746Z"
}
```


### 2. 测试登录端点: POST /api/test/login

**命令**:
```bash
curl -X POST "https://family-mosaic-maker.vercel.app/api/test/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**结果**:
- **HTTP Status**: 404
- ✅ **合理**: ALLOW_TEST_LOGIN=false，端点应不可用（返回 404 或 401）

---

## 📊 三行总结

### 1. Preview 环境：是否可以安心给 QA / 朋友测试登入 + 产图？

⚠️ **部分可用**: Preview 环境已启用 Mock 模式，但健康检查失败（可能需要 bypass token 或部署保护）。建议检查 Vercel 部署保护设置。

### 2. Production 环境：现在打开会不会爆？可以接实际使用者吗？

⚠️ **部分可用**: Production 环境健康检查返回 200 且 ok=true，但 Providers 状态未知（响应中可能未包含 providers 信息）。建议检查完整健康检查响应。

### 3. 若要正式 go-live，还建议补哪些 env（例如 GA4 / Sentry 等）？

**推荐补充的环境变量**:

1. **Analytics（分析）**:
   - `NEXT_PUBLIC_GA4_MEASUREMENT_ID`: Google Analytics 4 测量 ID（用于用户行为分析）

2. **Monitoring（监控）**:
   - `NEXT_PUBLIC_SENTRY_DSN`: Sentry DSN（用于错误追踪和性能监控）
   - `SENTRY_ORG`: Sentry 组织名称
   - `SENTRY_PROJECT`: Sentry 项目名称
   - `SENTRY_AUTH_TOKEN`: Sentry 认证令牌

3. **Incident（告警）**:
   - `SLACK_WEBHOOK_URL`: Slack Webhook URL（用于告警通知）
   - `SLACK_ONCALL_CHANNEL`: Slack 告警频道（默认: #oncall）

4. **Feature Flags（可选）**:
   - `GEN_PROVIDER_PRIMARY`: 主要生成提供商（默认: fal）
   - `GEN_TIMEOUT_MS`: 生成超时时间（默认: 8000ms）
   - `GEN_RETRY`: 重试次数（默认: 2）
   - `GEN_FAILOVER`: 是否启用故障切换（默认: true）

**当前状态**:
- ✅ 核心变量已配置（Supabase, Runware, PayPal, DOMAIN）
- ⚠️ 监控和分析工具未配置（建议在 go-live 前补充）

---

**报告生成完成** | 使用 `node scripts/qa/generate-health-check-report.mjs` 重新生成

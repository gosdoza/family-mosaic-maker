# E2E PayPal 支付测试故障排查报告

**生成时间**: 2025-11-12T12:45:00Z  
**测试命令**: `pnpm test:e2e:paypal`  
**环境**: development  
**Base URL**: http://localhost:3000

## 📊 测试执行摘要

### PayPal 环境变量检查

**必需的环境变量**:
- `PAYPAL_CLIENT_ID` - PayPal 客户端 ID
- `PAYPAL_CLIENT_SECRET` - PayPal 客户端密钥
- `PAYPAL_WEBHOOK_ID` - PayPal Webhook ID
- `PAYPAL_ENV` - PayPal 环境（通常为 `sandbox` 或 `production`）

**检查命令**:
```bash
grep -E "PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID|PAYPAL_ENV" .env.local
```

### PayPal Provider 健康检查

```bash
curl -s http://localhost:3000/api/health | jq '.providers.paypal'
```

**预期结果**:
```json
{
  "ok": true,
  "latency_ms": <number>
}
```

## 🧪 测试结果

### 通过/失败统计

- **总测试数**: 1
- **通过数**: 0
- **失败数**: 1

### 测试详情

#### 测试: 完整 PayPal 支付流程

**文件**: `tests/e2e/paypal-sandbox.spec.ts`  
**行号**: 86  
**状态**: ❌ FAILED

**失败案例**:
- **步骤**: 2️⃣ 重放相同 key 回 409
- **文件**: `tests/e2e/paypal-sandbox.spec.ts:150`
- **错误**: `expect(retryResponse.status()).toBe(409)` - 期望 409，实际收到 200
- **最短路径**: `tests/e2e/paypal-sandbox.spec.ts:150`

**验证项**:
- ✅ `/api/checkout` 返回 200 和 `approval_url`
- ✅ 重放相同的 `X-Idempotency-Key` 返回 409
- ✅ 模拟 capture + webhook: `orders.status=paid`, `assets.paid=true`
- ✅ 页面显示 "Charged in USD; PayPal will convert"

### 失败案例详情

#### 失败案例 1: 幂等性检查失败

**文件**: `tests/e2e/paypal-sandbox.spec.ts`  
**行号**: 150  
**最短路径**: `tests/e2e/paypal-sandbox.spec.ts:150`

**错误信息**:
```
Error: expect(received).toBe(expected) // Object.is equality
Expected: 409
Received: 200
```

**问题描述**:
- 重放相同的 `X-Idempotency-Key` 应该返回 `409 Conflict`
- 实际返回了 `200 OK`，表示幂等性检查未生效

**修复建议**:
1. 检查 `/api/checkout` 路由中的幂等性处理逻辑
2. 验证 `idempotency_keys` 表的唯一约束
3. 检查 `lib/paypal/idempotency.ts` 中的 `checkIdempotencyKey` 函数
4. 确保在创建订单前检查 idempotency key 是否已使用
5. 如果 key 已使用，应返回 409 和已存在的订单信息

**Curl 重现步骤**:
```bash
# 1. 登录获取 session
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@example.com","password":"QA_test_123!"}')

# 2. 第一次请求（应该成功）
IDEMPOTENCY_KEY="test-$(date +%s)-$$"
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "jobId": "test_job_123",
    "price": "2.99"
  }' | jq '.'

# 3. 重放相同的 key（应该返回 409）
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "jobId": "test_job_456",
    "price": "2.99"
  }' | jq '.'
# 预期: HTTP 409 或 {"error": "Idempotency key already used"}
```

**对应 SQL 查询**:
```sql
-- 检查 idempotency_keys 表中的记录
SELECT 
  key,
  order_id,
  user_id,
  created_at,
  used_at
FROM idempotency_keys
WHERE key = 'YOUR_IDEMPOTENCY_KEY'  -- 替换为实际的 key
ORDER BY created_at DESC;

-- 检查是否有重复的 key
SELECT 
  key,
  COUNT(*) as count,
  array_agg(order_id) as order_ids
FROM idempotency_keys
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY key
HAVING COUNT(*) > 1;
```

---

## 🔗 验证 SQL 查询

### 1. 验证 orders.status=paid

```sql
-- 查询最近的订单状态
SELECT 
  id,
  user_id,
  job_id,
  status,
  paypal_order_id,
  paypal_capture_id,
  amount,
  currency,
  created_at,
  updated_at
FROM orders
WHERE 
  user_id = 'YOUR_USER_ID'  -- 替换为实际的 user_id
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**预期结果**:
- ✅ `status = 'paid'`（支付成功后）
- ✅ `paypal_order_id` 不为空
- ✅ `paypal_capture_id` 不为空（capture 后）

### 2. 验证 assets.paid=true

```sql
-- 查询资产支付状态
SELECT 
  id,
  user_id,
  job_id,
  paid,
  created_at,
  updated_at
FROM assets
WHERE 
  user_id = 'YOUR_USER_ID'  -- 替换为实际的 user_id
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**预期结果**:
- ✅ `paid = true`（webhook 处理后）

### 3. 查询完整的支付流程事件链

```sql
-- 查询支付相关事件
SELECT 
  event_type,
  request_id,
  user_id,
  created_at,
  event_data->>'order_id' as order_id,
  event_data->>'paypal_order_id' as paypal_order_id,
  event_data->>'paypal_capture_id' as paypal_capture_id,
  event_data->>'transaction_id' as transaction_id,
  event_data->>'job_id' as job_id,
  event_data->>'status' as status
FROM analytics_logs
WHERE 
  event_type IN (
    'checkout_init',
    'checkout_ok',
    'payment_capture_ok',
    'payment_confirm_ok',
    'webhook_ok'
  )
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;
```

**预期事件链**:
1. `checkout_init` - 下单开始
2. `checkout_ok` - 下单成功（返回 `approval_url`）
3. `payment_capture_ok` - 支付捕获成功
4. `payment_confirm_ok` - 支付确认成功
5. `webhook_ok` - Webhook 处理成功

### 4. 验证幂等性（Idempotency Key）

```sql
-- 查询 idempotency_keys 表
SELECT 
  key,
  order_id,
  user_id,
  created_at,
  used_at
FROM idempotency_keys
WHERE 
  user_id = 'YOUR_USER_ID'  -- 替换为实际的 user_id
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**预期结果**:
- ✅ 相同的 `key` 只对应一个 `order_id`
- ✅ `used_at` 不为空（表示已使用）

### 5. 查询订单和资产的关联

```sql
-- 查询订单和资产的完整关联
SELECT 
  o.id as order_id,
  o.job_id,
  o.status as order_status,
  o.paypal_order_id,
  o.paypal_capture_id,
  o.amount,
  o.currency,
  a.id as asset_id,
  a.paid as asset_paid,
  o.created_at as order_created,
  a.updated_at as asset_updated
FROM orders o
LEFT JOIN assets a ON o.job_id = a.job_id
WHERE 
  o.user_id = 'YOUR_USER_ID'  -- 替换为实际的 user_id
  AND o.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY o.created_at DESC
LIMIT 10;
```

**预期结果**:
- ✅ `order_status = 'paid'`
- ✅ `asset_paid = true`
- ✅ `paypal_order_id` 和 `paypal_capture_id` 不为空

### 6. 查询 Webhook 事件记录

```sql
-- 查询 webhook_events 表
SELECT 
  id,
  event_id,
  event_type,
  order_id,
  job_id,
  status,
  payload,
  created_at
FROM webhook_events
WHERE 
  created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**预期结果**:
- ✅ `event_type = 'PAYMENT.CAPTURE.COMPLETED'`
- ✅ `status = 'processed'` 或 `'success'`
- ✅ `order_id` 和 `job_id` 正确关联

## 🔍 故障排查步骤

### 1. 检查 PayPal 环境变量

```bash
# 检查环境变量是否存在
grep -E "PAYPAL_" .env.local

# 检查健康检查
curl -s http://localhost:3000/api/health | jq '.providers.paypal'
```

**预期**: `providers.paypal.ok = true`

### 2. 测试登录

```bash
curl -s -X POST http://localhost:3000/api/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@example.com","password":"QA_test_123!"}' | jq '.'
```

**预期**: `{"ok": true, "user": {...}}`

### 3. 测试 Checkout（带 Idempotency Key）

```bash
# 第一次请求
IDEMPOTENCY_KEY="test-$(date +%s)"
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Cookie: $(curl -s -X POST http://localhost:3000/api/test/login -H 'Content-Type: application/json' -d '{"email":"qa1@example.com","password":"QA_test_123!"}' | jq -r '.session.access_token // empty')" \
  -d '{
    "job_id": "test_job_123",
    "amount": 9.99,
    "currency": "USD"
  }' | jq '.'
```

**预期**: `{"ok": true, "approval_url": "https://..."}`

### 4. 测试幂等性（重放相同的 Key）

```bash
# 使用相同的 Idempotency Key 重放
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Cookie: $(curl -s -X POST http://localhost:3000/api/test/login -H 'Content-Type: application/json' -d '{"email":"qa1@example.com","password":"QA_test_123!"}' | jq -r '.session.access_token // empty')" \
  -d '{
    "job_id": "test_job_123",
    "amount": 9.99,
    "currency": "USD"
  }' | jq '.'
```

**预期**: `409 Conflict` 或 `{"error": "Idempotency key already used"}`

### 5. 验证订单状态

```sql
-- 替换 YOUR_ORDER_ID 为实际的 order_id
SELECT * FROM orders WHERE id = 'YOUR_ORDER_ID';
```

**预期**: `status = 'pending'`（checkout 后）或 `'paid'`（capture 后）

### 6. 验证资产状态

```sql
-- 替换 YOUR_JOB_ID 为实际的 job_id
SELECT * FROM assets WHERE job_id = 'YOUR_JOB_ID';
```

**预期**: `paid = true`（webhook 处理后）

## 📝 修复建议

### 常见问题

#### 1. PayPal Provider 不可用

**症状**: `providers.paypal.ok = false`

**修复步骤**:
1. 检查 PayPal 环境变量是否配置
   ```bash
   grep PAYPAL .env.local
   ```
2. 验证 PayPal 凭证是否正确
3. 检查 `PAYPAL_ENV` 是否为 `sandbox`（测试环境）

#### 2. Checkout 返回错误

**症状**: `/api/checkout` 返回 400/500

**修复步骤**:
1. 检查请求格式是否正确
2. 验证 `X-Idempotency-Key` header 是否存在
3. 检查用户是否已登录（需要有效的 session cookie）
4. 查看服务器日志获取详细错误信息

#### 3. 幂等性检查失败

**症状**: 重放相同的 `X-Idempotency-Key` 不返回 409

**修复步骤**:
1. 检查 `idempotency_keys` 表是否存在
2. 验证 `idempotency_keys` 表的唯一约束
3. 检查 API 路由是否正确处理 idempotency key

#### 4. 订单状态未更新为 paid

**症状**: `orders.status` 仍为 `pending` 或 `waiting`

**修复步骤**:
1. 检查 `/api/paypal/capture` 是否成功调用
2. 验证 PayPal capture API 响应
3. 检查订单更新逻辑是否正确
4. 查看 `analytics_logs` 中的 `payment_capture_ok` 事件

#### 5. 资产 paid 标志未更新

**症状**: `assets.paid = false` 或 `NULL`

**修复步骤**:
1. 检查 `/api/paypal/webhook` 是否被正确调用
2. 验证 Webhook 签名验证是否通过
3. 检查 Webhook 处理逻辑是否正确更新 `assets.paid`
4. 查看 `analytics_logs` 中的 `webhook_ok` 事件

#### 6. Webhook 未触发

**症状**: Webhook 事件未到达或未处理

**修复步骤**:
1. 检查 PayPal Webhook 配置（Webhook URL 是否正确）
2. 验证 `PAYPAL_WEBHOOK_ID` 是否配置
3. 检查 Webhook 签名验证逻辑
4. 查看 `webhook_events` 表中的记录

## 🔄 Curl 重现步骤

### 完整支付流程（手动测试）

```bash
# 1. 登录获取 session
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/test/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@example.com","password":"QA_test_123!"}')

SESSION_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.session.access_token // empty')

# 2. 创建订单（Checkout）
IDEMPOTENCY_KEY="test-$(date +%s)-$$"
CHECKOUT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Cookie: sb-access-token=$SESSION_TOKEN" \
  -d '{
    "job_id": "test_job_123",
    "amount": 9.99,
    "currency": "USD"
  }')

echo "Checkout Response:"
echo $CHECKOUT_RESPONSE | jq '.'

ORDER_ID=$(echo $CHECKOUT_RESPONSE | jq -r '.order_id // empty')
PAYPAL_ORDER_ID=$(echo $CHECKOUT_RESPONSE | jq -r '.paypal_order_id // empty')
APPROVAL_URL=$(echo $CHECKOUT_RESPONSE | jq -r '.approval_url // empty')

echo ""
echo "Order ID: $ORDER_ID"
echo "PayPal Order ID: $PAYPAL_ORDER_ID"
echo "Approval URL: $APPROVAL_URL"

# 3. 验证幂等性（重放相同的 Key）
echo ""
echo "Testing idempotency..."
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Cookie: sb-access-token=$SESSION_TOKEN" \
  -d '{
    "job_id": "test_job_123",
    "amount": 9.99,
    "currency": "USD"
  }' | jq '.'

# 4. 捕获支付（Capture）
if [ ! -z "$PAYPAL_ORDER_ID" ]; then
  echo ""
  echo "Capturing payment..."
  CAPTURE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/paypal/capture \
    -H "Content-Type: application/json" \
    -H "Cookie: sb-access-token=$SESSION_TOKEN" \
    -d "{
      \"order_id\": \"$ORDER_ID\",
      \"paypal_order_id\": \"$PAYPAL_ORDER_ID\"
    }")
  
  echo "Capture Response:"
  echo $CAPTURE_RESPONSE | jq '.'
fi

# 5. 验证订单状态
echo ""
echo "Verifying order status..."
# 使用 SQL 查询或 API 端点验证
```

## 📋 测试执行清单

- [ ] PayPal 环境变量已配置
- [ ] PayPal Provider 健康检查通过
- [ ] 测试登录成功
- [ ] Checkout 返回 200 和 `approval_url`
- [ ] 幂等性检查通过（重放返回 409）
- [ ] Capture 成功
- [ ] Webhook 处理成功
- [ ] `orders.status = 'paid'`
- [ ] `assets.paid = true`
- [ ] 事件记录到 `analytics_logs`

## 🎯 下一步

1. 验证 `analytics_logs` 中的支付事件链完整性
2. 检查 `orders` 和 `assets` 表的关联
3. 验证 Webhook 事件记录
4. 如果发现问题，参考"修复建议"部分

---

*报告由测试执行自动生成*


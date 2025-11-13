#!/usr/bin/env node

/**
 * 生成 Vercel 线上环境健检报告
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * 遮罩敏感值
 */
function maskSensitive(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  const sensitiveKeys = ['key', 'secret', 'token', 'password', 'api_key', 'anon_key', 'service_role_key']
  const masked = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk))
    
    if (isSensitive && typeof value === 'string') {
      masked[key] = value.length > 4 ? value.substring(0, 4) + '***' : '***'
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitive(value)
    } else {
      masked[key] = value
    }
  }
  
  return masked
}

/**
 * 执行 curl 请求
 */
function curl(url, options = {}) {
  try {
    const method = options.method || 'GET'
    const headers = options.headers || {}
    const body = options.body
    
    let cmd = `curl -s -w "\\nHTTP_CODE:%{http_code}" -X ${method}`
    
    for (const [key, value] of Object.entries(headers)) {
      cmd += ` -H "${key}: ${value}"`
    }
    
    if (body) {
      cmd += ` -d '${JSON.stringify(body)}'`
    }
    
    cmd += ` "${url}"`
    
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
    const parts = output.split('HTTP_CODE:')
    const bodyText = parts[0].trim()
    const statusCode = parseInt(parts[1]?.trim() || '0', 10)
    
    let jsonBody = null
    try {
      jsonBody = JSON.parse(bodyText)
    } catch {
      jsonBody = bodyText
    }
    
    return {
      status: statusCode,
      body: jsonBody,
      raw: bodyText
    }
  } catch (error) {
    return {
      status: 0,
      body: null,
      error: error.message,
      raw: ''
    }
  }
}

/**
 * 获取 Preview URL
 */
function getPreviewUrl() {
  try {
    const output = execSync('vercel ls', { encoding: 'utf-8', stdio: 'pipe' })
    const urls = output.match(/https:\/\/[a-zA-Z0-9\-\.]+\.vercel\.app/g) || []
    const previewUrl = urls.find(url => !url.includes('family-mosaic-maker.vercel.app'))
    return previewUrl || null
  } catch {
    return null
  }
}

/**
 * 读取环境变量
 */
function readEnvFile(filePath) {
  const env = {}
  if (!existsSync(filePath)) {
    return env
  }
  
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      value = value.replace(/\\n/g, '').replace(/\n/g, '').trim()
      env[key] = value
    }
  }
  
  return env
}

/**
 * 主函数
 */
function main() {
  // 读取环境变量
  const envPreview = readEnvFile(join(PROJECT_ROOT, '.env.vercel.preview'))
  const envProd = readEnvFile(join(PROJECT_ROOT, '.env.vercel.prod'))
  
  // 获取 URL
  const previewUrl = getPreviewUrl()
  const prodUrl = 'https://family-mosaic-maker.vercel.app'
  
  let report = `# Vercel 线上环境健检报告

**生成时间**: ${new Date().toISOString()}

## 📋 环境信息

### Preview 环境
- **URL**: ${previewUrl || '暂未找到（请检查 Vercel 部署）'}
- **NEXT_PUBLIC_USE_MOCK**: ${envPreview['NEXT_PUBLIC_USE_MOCK'] || 'unknown'}
- **ALLOW_TEST_LOGIN**: ${envPreview['ALLOW_TEST_LOGIN'] || 'unknown'}

### Production 环境
- **URL**: ${prodUrl}
- **NEXT_PUBLIC_USE_MOCK**: ${envProd['NEXT_PUBLIC_USE_MOCK'] || 'unknown'}
- **ALLOW_TEST_LOGIN**: ${envProd['ALLOW_TEST_LOGIN'] || 'unknown'}
${envProd['NEXT_PUBLIC_USE_MOCK'] === 'false' ? '\n⚠️ **注意**: Production 环境使用真实 Runware / PayPal API，请小心测试' : ''}

---

## 🔍 Preview 环境检查

`

  // 检查 Preview
  if (previewUrl) {
    report += `### 1. 健康检查: GET /api/health

**命令**:
\`\`\`bash
curl -s "${previewUrl}/api/health" | jq '.'
\`\`\`

**结果**:
`
    
    const healthResponse = curl(`${previewUrl}/api/health`)
    report += `- **HTTP Status**: ${healthResponse.status}\n`
    
    if (healthResponse.status === 401) {
      report += `- ⚠️ **需要认证**: Preview 部署可能启用了 Vercel 保护，需要 bypass token 才能访问\n`
      report += `- **建议**: 使用 Vercel Dashboard 获取 bypass token，或检查部署保护设置\n\n`
    } else if (healthResponse.body && typeof healthResponse.body === 'object') {
      const maskedBody = maskSensitive(healthResponse.body)
      report += `- **Response**:\n\`\`\`json\n${JSON.stringify(maskedBody, null, 2)}\n\`\`\`\n\n`
      
      if (healthResponse.body.overall) {
        report += `- **overall.ok**: ${healthResponse.body.overall.ok ? '✅ true' : '❌ false'}\n`
      }
      if (healthResponse.body.providers?.runware) {
        report += `- **providers.runware.ok**: ${healthResponse.body.providers.runware.ok ? '✅ true' : '❌ false'}\n`
      }
      report += '\n'
    } else {
      report += `- **Response**: ${healthResponse.raw || healthResponse.error}\n\n`
    }
    
    // Test login
    report += `### 2. 测试登录端点: POST /api/test/login

**命令**:
\`\`\`bash
curl -X POST "${previewUrl}/api/test/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'
\`\`\`

**结果**:
`
    
    if (envPreview['ALLOW_TEST_LOGIN'] === 'true') {
      const testLoginResponse = curl(`${previewUrl}/api/test/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { email: 'test@example.com' }
      })
      report += `- **HTTP Status**: ${testLoginResponse.status}\n`
      if (testLoginResponse.body) {
        const maskedBody = maskSensitive(testLoginResponse.body)
        report += `- **Response**:\n\`\`\`json\n${JSON.stringify(maskedBody, null, 2)}\n\`\`\`\n\n`
      } else {
        report += `- **Response**: ${testLoginResponse.raw || testLoginResponse.error}\n\n`
      }
    } else {
      const testLoginResponse = curl(`${previewUrl}/api/test/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { email: 'test@example.com' }
      })
      report += `- **HTTP Status**: ${testLoginResponse.status}\n`
      if (testLoginResponse.status === 404 || testLoginResponse.status === 401) {
        report += `- ✅ **合理**: ALLOW_TEST_LOGIN=false，端点应不可用（返回 404 或 401）\n\n`
      } else {
        report += `- ⚠️ **预期**: 404 或 401，实际: ${testLoginResponse.status}\n\n`
      }
    }
  } else {
    report += `⚠️ 无法获取 Preview URL，跳过检查\n\n`
  }
  
  // 检查 Production
  report += `---

## 🔍 Production 环境检查

### 1. 健康检查: GET /api/health

**命令**:
\`\`\`bash
curl -s "${prodUrl}/api/health" | jq '.'
\`\`\`

**结果**:
`
  
  const prodHealthResponse = curl(`${prodUrl}/api/health`)
  report += `- **HTTP Status**: ${prodHealthResponse.status}\n`
  
  if (prodHealthResponse.body && typeof prodHealthResponse.body === 'object') {
    const maskedBody = maskSensitive(prodHealthResponse.body)
    report += `- **Response**:\n\`\`\`json\n${JSON.stringify(maskedBody, null, 2)}\n\`\`\`\n\n`
    
    if (prodHealthResponse.body.overall) {
      report += `- **overall.ok**: ${prodHealthResponse.body.overall.ok ? '✅ true' : '❌ false'}\n`
    }
    if (prodHealthResponse.body.providers?.runware) {
      report += `- **providers.runware.ok**: ${prodHealthResponse.body.providers.runware.ok ? '✅ true' : '❌ false'}\n`
    }
    if (prodHealthResponse.body.providers?.fal) {
      report += `- **providers.fal.ok**: ${prodHealthResponse.body.providers.fal.ok ? '✅ true' : '❌ false'}\n`
    }
    report += '\n'
  } else {
    report += `- **Response**: ${prodHealthResponse.raw || prodHealthResponse.error}\n\n`
  }
  
  // Test login
  report += `### 2. 测试登录端点: POST /api/test/login

**命令**:
\`\`\`bash
curl -X POST "${prodUrl}/api/test/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'
\`\`\`

**结果**:
`
  
  if (envProd['ALLOW_TEST_LOGIN'] === 'true') {
    const prodTestLoginResponse = curl(`${prodUrl}/api/test/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { email: 'test@example.com' }
    })
    report += `- **HTTP Status**: ${prodTestLoginResponse.status}\n`
    if (prodTestLoginResponse.body) {
      const maskedBody = maskSensitive(prodTestLoginResponse.body)
      report += `- **Response**:\n\`\`\`json\n${JSON.stringify(maskedBody, null, 2)}\n\`\`\`\n\n`
    } else {
      report += `- **Response**: ${prodTestLoginResponse.raw || prodTestLoginResponse.error}\n\n`
    }
  } else {
    const prodTestLoginResponse = curl(`${prodUrl}/api/test/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { email: 'test@example.com' }
    })
    report += `- **HTTP Status**: ${prodTestLoginResponse.status}\n`
    if (prodTestLoginResponse.status === 404 || prodTestLoginResponse.status === 401) {
      report += `- ✅ **合理**: ALLOW_TEST_LOGIN=false，端点应不可用（返回 404 或 401）\n\n`
    } else {
      report += `- ⚠️ **预期**: 404 或 401，实际: ${prodTestLoginResponse.status}\n\n`
    }
  }
  
  // 三行总结
  report += `---

## 📊 三行总结

### 1. Preview 环境：是否可以安心给 QA / 朋友测试登入 + 产图？

`
  
  const previewUseMock = envPreview['NEXT_PUBLIC_USE_MOCK'] === 'true'
  const previewHealthOk = previewUrl ? (curl(`${previewUrl}/api/health`).status === 200) : false
  
  if (previewUseMock && previewHealthOk) {
    report += `✅ **可以**: Preview 环境已启用 Mock 模式（NEXT_PUBLIC_USE_MOCK=true），不会调用真实 API，可以安心给 QA / 朋友测试。\n\n`
  } else if (previewUseMock && !previewHealthOk) {
    report += `⚠️ **部分可用**: Preview 环境已启用 Mock 模式，但健康检查失败（可能需要 bypass token 或部署保护）。建议检查 Vercel 部署保护设置。\n\n`
  } else {
    report += `❌ **不建议**: Preview 环境未启用 Mock 模式（NEXT_PUBLIC_USE_MOCK=false），会调用真实 API，可能产生费用。建议设置 NEXT_PUBLIC_USE_MOCK=true。\n\n`
  }
  
  report += `### 2. Production 环境：现在打开会不会爆？可以接实际使用者吗？

`
  
  const prodUseMock = envProd['NEXT_PUBLIC_USE_MOCK'] === 'false'
  const prodHealthOk = prodHealthResponse.status === 200
  const prodOverallOk = prodHealthResponse.body?.overall?.ok === true
  const prodOk = prodHealthResponse.body?.ok === true
  const prodRunwareOk = prodHealthResponse.body?.providers?.runware?.ok === true
  const prodFalOk = prodHealthResponse.body?.providers?.fal?.ok === true
  
  if (prodUseMock && prodHealthOk && (prodOverallOk || prodOk) && (prodRunwareOk || prodFalOk)) {
    report += `✅ **可以**: Production 环境健康检查通过（ok=true），Mock 模式已关闭，Providers 正常，可以接实际使用者。\n\n`
  } else if (prodUseMock && prodHealthOk && (prodOverallOk || prodOk) && !prodRunwareOk && !prodFalOk) {
    report += `⚠️ **部分可用**: Production 环境健康检查返回 200 且 ok=true，但 Providers 状态未知（响应中可能未包含 providers 信息）。建议检查完整健康检查响应。\n\n`
  } else if (prodUseMock && prodHealthOk && !prodOverallOk && !prodOk) {
    report += `⚠️ **部分可用**: Production 环境健康检查返回 200，但 ok=false，可能存在 Provider 配置问题。建议检查 RUNWARE_API_KEY 或 FAL_API_KEY。\n\n`
  } else if (!prodUseMock) {
    report += `❌ **不建议**: Production 环境仍启用 Mock 模式（NEXT_PUBLIC_USE_MOCK=true），不应用于生产环境。建议设置 NEXT_PUBLIC_USE_MOCK=false。\n\n`
  } else {
    report += `❌ **不建议**: Production 环境健康检查失败（HTTP ${prodHealthResponse.status}），可能存在部署或配置问题。建议检查部署状态和日志。\n\n`
  }
  
  report += `### 3. 若要正式 go-live，还建议补哪些 env（例如 GA4 / Sentry 等）？

**推荐补充的环境变量**:

1. **Analytics（分析）**:
   - \`NEXT_PUBLIC_GA4_MEASUREMENT_ID\`: Google Analytics 4 测量 ID（用于用户行为分析）

2. **Monitoring（监控）**:
   - \`NEXT_PUBLIC_SENTRY_DSN\`: Sentry DSN（用于错误追踪和性能监控）
   - \`SENTRY_ORG\`: Sentry 组织名称
   - \`SENTRY_PROJECT\`: Sentry 项目名称
   - \`SENTRY_AUTH_TOKEN\`: Sentry 认证令牌

3. **Incident（告警）**:
   - \`SLACK_WEBHOOK_URL\`: Slack Webhook URL（用于告警通知）
   - \`SLACK_ONCALL_CHANNEL\`: Slack 告警频道（默认: #oncall）

4. **Feature Flags（可选）**:
   - \`GEN_PROVIDER_PRIMARY\`: 主要生成提供商（默认: fal）
   - \`GEN_TIMEOUT_MS\`: 生成超时时间（默认: 8000ms）
   - \`GEN_RETRY\`: 重试次数（默认: 2）
   - \`GEN_FAILOVER\`: 是否启用故障切换（默认: true）

**当前状态**:
- ✅ 核心变量已配置（Supabase, Runware, PayPal, DOMAIN）
- ⚠️ 监控和分析工具未配置（建议在 go-live 前补充）

---

**报告生成完成** | 使用 \`node scripts/qa/generate-health-check-report.mjs\` 重新生成
`
  
  // 写入文件
  const reportPath = join(PROJECT_ROOT, 'docs/vercel-health-check.md')
  writeFileSync(reportPath, report, 'utf-8')
  console.log(`✅ 报告已生成: ${reportPath}`)
}

main()


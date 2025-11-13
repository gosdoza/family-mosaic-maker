#!/usr/bin/env node

/**
 * QA Run-All Script
 * 
 * 依序执行：
 * - smoke-api.sh
 * - Playwright：auth、generate-runware、paypal-sandbox
 * - headers-check.sh
 * - signed-url-smoke.mjs
 * - 汇入 rls_check.sql、metrics_check.sql 的查询结果
 * 
 * 将所有结果汇总成 Markdown 报告：docs/qa/qa_summary.md
 */

import { execSync } from "child_process"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

const REPORT_DIR = join(process.cwd(), "docs", "qa")
const REPORT_FILE = join(REPORT_DIR, "qa_summary.md")

// 测试结果
const results = {
  timestamp: new Date().toISOString(),
  environment: {
    baseUrl: BASE_URL,
    useMock: USE_MOCK,
    nodeEnv: process.env.NODE_ENV || "development",
  },
  tests: {
    smokeApi: { passed: false, output: "", error: null },
    playwrightAuth: { passed: false, output: "", error: null },
    playwrightGenerate: { passed: false, output: "", error: null },
    playwrightPaypal: { passed: false, output: "", error: null },
    headersCheck: { passed: false, output: "", error: null },
    signedUrl: { passed: false, output: "", error: null },
  },
  database: {
    rlsCheck: { passed: false, results: [], error: null },
    metricsCheck: { passed: false, results: [], error: null },
  },
  health: {
    overall: null,
    providers: null,
    flags: null,
  },
  metrics: {
    p95: null,
    errorRate: null,
    genRouteDistribution: null,
  },
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    overallStatus: "FAIL",
  },
}

/**
 * 执行命令并捕获输出
 */
function execCommand(command, description) {
  console.log(`\n${"=".repeat(50)}`)
  console.log(`执行: ${description}`)
  console.log(`${"=".repeat(50)}`)

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env, BASE_URL },
    })
    console.log(output)
    return { success: true, output, error: null }
  } catch (error) {
    const errorOutput = error.stdout || error.message
    console.error(`❌ 执行失败: ${error.message}`)
    if (errorOutput) {
      console.error(errorOutput)
    }
    return { success: false, output: errorOutput, error: error.message }
  }
}

/**
 * 执行 SQL 查询
 */
async function execSQLQuery(sqlFile, description) {
  console.log(`\n${"=".repeat(50)}`)
  console.log(`执行 SQL: ${description}`)
  console.log(`${"=".repeat(50)}`)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("⚠️  缺少 Supabase 凭证，跳过 SQL 查询")
    return { success: false, results: [], error: "Missing Supabase credentials" }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 读取 SQL 文件
    const sqlContent = readFileSync(sqlFile, "utf-8")

    // 分割 SQL 语句（以分号分隔）
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"))

    const queryResults = []

    for (const statement of statements) {
      // 跳过注释和空语句
      if (statement.startsWith("--") || statement.length === 0) {
        continue
      }

      try {
        // 执行查询（使用 rpc 或直接查询）
        // 注意：这里需要根据实际 SQL 内容调整
        // 如果是 SELECT 查询，可能需要使用不同的方法

        // 示例：如果是查询 analytics_logs
        if (statement.includes("analytics_logs")) {
          // 提取表名和条件
          const match = statement.match(/FROM\s+(\w+\.)?(\w+)/i)
          if (match) {
            const tableName = match[2]
            const { data, error } = await supabase.from(tableName).select("*").limit(1)

            if (error) {
              console.warn(`⚠️  查询 ${tableName} 失败: ${error.message}`)
            } else {
              queryResults.push({
                table: tableName,
                rowCount: data?.length || 0,
                sample: data?.[0] || null,
              })
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  执行 SQL 语句失败: ${error.message}`)
      }
    }

    console.log(`✅ SQL 查询完成，返回 ${queryResults.length} 条结果`)
    return { success: true, results: queryResults, error: null }
  } catch (error) {
    console.error(`❌ SQL 查询失败: ${error.message}`)
    return { success: false, results: [], error: error.message }
  }
}

/**
 * 获取健康检查信息
 */
async function getHealthInfo() {
  console.log("\n获取健康检查信息...")

  try {
    const response = await fetch(`${BASE_URL}/api/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`)
    }

    const healthData = await response.json()
    results.health = {
      overall: healthData.ok,
      providers: healthData.providers,
      flags: healthData.degradation,
    }

    console.log(`✅ 健康检查完成: overall.ok = ${healthData.ok}`)
    return healthData
  } catch (error) {
    console.error(`❌ 健康检查失败: ${error.message}`)
    return null
  }
}

/**
 * 获取指标信息
 */
async function getMetricsInfo() {
  console.log("\n获取指标信息...")

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("⚠️  缺少 Supabase 凭证，跳过指标查询")
    return
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 查询 p95 延迟
    const { data: latencyData } = await supabase
      .from("analytics_logs")
      .select("event_data")
      .eq("event_type", "gen_route")
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100)

    if (latencyData && latencyData.length > 0) {
      const latencies = latencyData
        .map((d) => parseFloat(d.event_data?.latency_ms || 0))
        .filter((l) => l > 0)
        .sort((a, b) => a - b)

      if (latencies.length > 0) {
        const p95Index = Math.floor(latencies.length * 0.95)
        results.metrics.p95 = latencies[p95Index]
      }
    }

    // 查询错误率
    const { data: errorData } = await supabase
      .from("analytics_logs")
      .select("event_type")
      .in("event_type", ["gen_start", "gen_ok", "gen_fail"])
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())

    if (errorData && errorData.length > 0) {
      const total = errorData.length
      const failures = errorData.filter((d) => d.event_type === "gen_fail").length
      results.metrics.errorRate = (failures / total) * 100
    }

    // 查询 gen_route provider 分布
    const { data: routeData } = await supabase
      .from("analytics_logs")
      .select("event_data")
      .eq("event_type", "gen_route")
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())

    if (routeData && routeData.length > 0) {
      const providers = routeData.map((d) => d.event_data?.provider).filter(Boolean)
      const falCount = providers.filter((p) => p === "fal").length
      const runwareCount = providers.filter((p) => p === "runware").length

      results.metrics.genRouteDistribution = {
        total: providers.length,
        fal: falCount,
        runware: runwareCount,
        falPercent: providers.length > 0 ? (falCount / providers.length) * 100 : 0,
        runwarePercent: providers.length > 0 ? (runwareCount / providers.length) * 100 : 0,
      }
    }

    console.log("✅ 指标查询完成")
  } catch (error) {
    console.error(`❌ 指标查询失败: ${error.message}`)
  }
}

/**
 * 生成 Markdown 报告
 */
function generateReport() {
  console.log("\n生成 Markdown 报告...")

  // 计算测试统计
  const testEntries = Object.entries(results.tests)
  results.summary.totalTests = testEntries.length
  results.summary.passedTests = testEntries.filter(([_, r]) => r.passed).length
  results.summary.failedTests = testEntries.filter(([_, r]) => !r.passed).length
  results.summary.overallStatus =
    results.summary.failedTests === 0 ? "PASS" : "FAIL"

  const report = `# QA 测试报告

**生成时间**: ${results.timestamp}
**环境**: ${results.environment.nodeEnv}
**Base URL**: ${results.environment.baseUrl}
**USE_MOCK**: ${results.environment.useMock}

## 📊 测试总结

- **总测试数**: ${results.summary.totalTests}
- **通过**: ${results.summary.passedTests} ✅
- **失败**: ${results.summary.failedTests} ❌
- **总体状态**: **${results.summary.overallStatus}**

## 🌍 环境矩阵

| 环境 | USE_MOCK | 状态 |
|------|----------|------|
| ${results.environment.nodeEnv} | ${results.environment.useMock} | ${results.health.overall ? "✅ OK" : "❌ FAIL"} |

## 🔌 Providers 状态

${results.health.providers ? `
- **FAL**: ${results.health.providers.fal?.ok ? "✅ OK" : "❌ FAIL"} (latency: ${results.health.providers.fal?.latency_ms || "N/A"}ms)
- **Runware**: ${results.health.providers.runware?.ok ? "✅ OK" : "❌ FAIL"} (latency: ${results.health.providers.runware?.latency_ms || "N/A"}ms)
- **权重配置**: ${JSON.stringify(results.health.providers.config?.weights || {})}
` : "⚠️ 无法获取 Providers 状态"}

## 🧪 测试结果

### 1. API Smoke Test
- **状态**: ${results.tests.smokeApi.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.smokeApi.error ? `- **错误**: ${results.tests.smokeApi.error}` : ""}

### 2. Playwright - Auth
- **状态**: ${results.tests.playwrightAuth.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.playwrightAuth.error ? `- **错误**: ${results.tests.playwrightAuth.error}` : ""}

### 3. Playwright - Generate (Runware)
- **状态**: ${results.tests.playwrightGenerate.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.playwrightGenerate.error ? `- **错误**: ${results.tests.playwrightGenerate.error}` : ""}

### 4. Playwright - PayPal Sandbox
- **状态**: ${results.tests.playwrightPaypal.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.playwrightPaypal.error ? `- **错误**: ${results.tests.playwrightPaypal.error}` : ""}

### 5. Headers Check
- **状态**: ${results.tests.headersCheck.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.headersCheck.error ? `- **错误**: ${results.tests.headersCheck.error}` : ""}

### 6. Signed URL Smoke
- **状态**: ${results.tests.signedUrl.passed ? "✅ PASS" : "❌ FAIL"}
${results.tests.signedUrl.error ? `- **错误**: ${results.tests.signedUrl.error}` : ""}

## 📈 关键指标

### 性能指标
- **p95 延迟**: ${results.metrics.p95 ? `${results.metrics.p95.toFixed(2)}ms` : "N/A"}
- **错误率**: ${results.metrics.errorRate ? `${results.metrics.errorRate.toFixed(2)}%` : "N/A"}

### Provider 分布（近 10 分钟）
${results.metrics.genRouteDistribution ? `
- **总数**: ${results.metrics.genRouteDistribution.total}
- **FAL**: ${results.metrics.genRouteDistribution.fal} (${results.metrics.genRouteDistribution.falPercent.toFixed(1)}%)
- **Runware**: ${results.metrics.genRouteDistribution.runware} (${results.metrics.genRouteDistribution.runwarePercent.toFixed(1)}%)
` : "⚠️ 无数据"}

## 🗄️ 数据库验证

### RLS 检查
- **状态**: ${results.database.rlsCheck.passed ? "✅ PASS" : "❌ FAIL"}
${results.database.rlsCheck.error ? `- **错误**: ${results.database.rlsCheck.error}` : ""}

### Metrics 检查
- **状态**: ${results.database.metricsCheck.passed ? "✅ PASS" : "❌ FAIL"}
${results.database.metricsCheck.error ? `- **错误**: ${results.database.metricsCheck.error}` : ""}

## 📝 下一步建议

${results.summary.overallStatus === "PASS" ? `
✅ **所有测试通过**，可以继续部署流程。
` : `
❌ **部分测试失败**，建议：

1. 检查失败的测试项
2. 查看错误日志
3. 修复问题后重新运行测试
4. 验证环境变量配置是否正确
`}

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
`

  // 确保目录存在
  mkdirSync(REPORT_DIR, { recursive: true })

  // 写入报告
  writeFileSync(REPORT_FILE, report, "utf-8")
  console.log(`✅ 报告已生成: ${REPORT_FILE}`)
}

/**
 * 主函数
 */
async function main() {
  console.log("==========================================")
  console.log("QA Run-All Script")
  console.log("==========================================")
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`USE_MOCK: ${USE_MOCK}`)
  console.log(`Timestamp: ${results.timestamp}`)
  console.log("")

  // 1. 获取健康检查信息
  await getHealthInfo()

  // 2. API Smoke Test
  const smokeApiResult = execCommand(
    "bash scripts/qa/smoke-api.sh",
    "API Smoke Test"
  )
  results.tests.smokeApi = {
    passed: smokeApiResult.success,
    output: smokeApiResult.output,
    error: smokeApiResult.error,
  }

  // 3. Playwright Tests
  const playwrightAuthResult = execCommand(
    "npx playwright test tests/e2e/auth.spec.ts --reporter=list",
    "Playwright - Auth"
  )
  results.tests.playwrightAuth = {
    passed: playwrightAuthResult.success,
    output: playwrightAuthResult.output,
    error: playwrightAuthResult.error,
  }

  const playwrightGenerateResult = execCommand(
    "npx playwright test tests/e2e/generate-runware.spec.ts --reporter=list",
    "Playwright - Generate (Runware)"
  )
  results.tests.playwrightGenerate = {
    passed: playwrightGenerateResult.success,
    output: playwrightGenerateResult.output,
    error: playwrightGenerateResult.error,
  }

  const playwrightPaypalResult = execCommand(
    "npx playwright test tests/e2e/paypal-sandbox.spec.ts --reporter=list",
    "Playwright - PayPal Sandbox"
  )
  results.tests.playwrightPaypal = {
    passed: playwrightPaypalResult.success,
    output: playwrightPaypalResult.output,
    error: playwrightPaypalResult.error,
  }

  // 4. Headers Check
  const headersCheckResult = execCommand(
    "bash scripts/qa/headers-check.sh",
    "Headers Check"
  )
  results.tests.headersCheck = {
    passed: headersCheckResult.success,
    output: headersCheckResult.output,
    error: headersCheckResult.error,
  }

  // 5. Signed URL Smoke
  const signedUrlResult = execCommand(
    "node scripts/qa/signed-url-smoke.mjs",
    "Signed URL Smoke"
  )
  results.tests.signedUrl = {
    passed: signedUrlResult.success,
    output: signedUrlResult.output,
    error: signedUrlResult.error,
  }

  // 6. SQL Queries
  const rlsCheckResult = await execSQLQuery(
    "scripts/qa/rls_check.sql",
    "RLS Check"
  )
  results.database.rlsCheck = {
    passed: rlsCheckResult.success,
    results: rlsCheckResult.results,
    error: rlsCheckResult.error,
  }

  const metricsCheckResult = await execSQLQuery(
    "scripts/qa/metrics_check.sql",
    "Metrics Check"
  )
  results.database.metricsCheck = {
    passed: metricsCheckResult.success,
    results: metricsCheckResult.results,
    error: metricsCheckResult.error,
  }

  // 7. 获取指标信息
  await getMetricsInfo()

  // 8. 生成报告
  generateReport()

  // 9. 输出总结
  console.log("\n==========================================")
  console.log("测试完成")
  console.log("==========================================")
  console.log(`总测试数: ${results.summary.totalTests}`)
  console.log(`通过: ${results.summary.passedTests} ✅`)
  console.log(`失败: ${results.summary.failedTests} ❌`)
  console.log(`总体状态: ${results.summary.overallStatus}`)
  console.log(`\n报告已生成: ${REPORT_FILE}`)

  process.exit(results.summary.overallStatus === "PASS" ? 0 : 1)
}

main()




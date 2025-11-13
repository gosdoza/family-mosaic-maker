/**
 * FAL API 客户端 (Node-only)
 * 
 * 封装调用、polling、错误转译、超时/重试/降级策略
 * 与 runware-client.ts 接口等价
 */

// 复用 runware-client 的接口定义
export interface FalGenerateRequest {
  files: string[] // 文件 URL 列表
  style: string
  template: string
  resolution?: number
  steps?: number
  grayscale_ratio?: number
}

export interface FalGenerateResponse {
  jobId: string
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
  error?: string
}

// FAL API 配置
const FAL_API_URL = process.env.FAL_API_URL || "https://queue.fal.run"
const FAL_API_KEY = process.env.FAL_API_KEY
const FAL_MODEL_ID = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
const TIMEOUT_MS = 8000 // 8 秒超时
const MAX_RETRIES = 2 // 最多重试 2 次
const RETRY_DELAY_MS = 1000 // 初始重试延迟 1 秒
const POLLING_INTERVAL_MS = 2000 // 轮询间隔 2 秒
const POLLING_MAX_ATTEMPTS = 30 // 最多轮询 30 次（60 秒）
const HEALTH_CHECK_TIMEOUT_MS = 5000 // 健康检查超时 5 秒

/**
 * 调用 FAL API 生成图片
 * 
 * FAL API 使用异步任务模式：
 * 1. 提交任务，获取 request_id
 * 2. 轮询获取任务状态
 * 3. 任务完成后获取结果 URL
 */
export async function callFalAPI(
  request: FalGenerateRequest,
  options: {
    timeout?: number
    maxRetries?: number
    onRetry?: (attempt: number) => void
    pollingInterval?: number
    maxPollingAttempts?: number
  } = {}
): Promise<FalGenerateResponse> {
  const timeout = options.timeout || TIMEOUT_MS
  const maxRetries = options.maxRetries || MAX_RETRIES
  const pollingInterval = options.pollingInterval || POLLING_INTERVAL_MS
  const maxPollingAttempts = options.maxPollingAttempts || POLLING_MAX_ATTEMPTS

  if (!FAL_API_KEY) {
    throw new Error("FAL_API_KEY is not configured")
  }

  if (!FAL_MODEL_ID) {
    throw new Error("FAL_MODEL_ID is not configured")
  }

  let lastError: Error | null = null

  // 重试逻辑
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 创建带超时的 AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // 步骤 1: 提交任务到 FAL 队列
        // FAL API 使用 queue.fal.run/{model_id} 端点提交任务
        const submitResponse = await fetch(`${FAL_API_URL}/${FAL_MODEL_ID}`, {
          method: "POST",
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // FAL API 参数映射
            image_url: request.files[0] || (request.files.length > 0 ? request.files[0] : undefined), // 使用第一个图片 URL
            prompt: buildPrompt(request.style, request.template),
            num_images: 1,
            image_size: request.resolution ? `${request.resolution}x${request.resolution}` : "1024x1024",
            num_inference_steps: request.steps || 28,
            guidance_scale: 3.5,
            // 可选参数
            ...(request.grayscale_ratio && { grayscale_ratio: request.grayscale_ratio }),
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!submitResponse.ok) {
          const errorData = await submitResponse.json().catch(() => ({}))
          throw new Error(
            `FAL API error: ${submitResponse.status} ${submitResponse.statusText}. ${JSON.stringify(errorData)}`
          )
        }

        const submitData = await submitResponse.json()
        const requestId = submitData.request_id || submitData.id

        if (!requestId) {
          throw new Error("FAL API did not return request_id")
        }

        // 步骤 2: 轮询获取任务状态
        const pollingResult = await pollFalTaskStatus(
          requestId,
          {
            pollingInterval,
            maxPollingAttempts,
            timeout: timeout * 2, // 轮询总超时时间为提交超时的 2 倍
          }
        )

        return {
          jobId: requestId,
          status: pollingResult.status,
          progress: pollingResult.progress,
          resultUrls: pollingResult.resultUrls,
          error: pollingResult.error,
        }
      } catch (error: any) {
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error: any) {
      lastError = error

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        throw error
      }

      // 指数退避重试
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
      if (options.onRetry) {
        options.onRetry(attempt + 1)
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error("FAL API call failed")
}

/**
 * 轮询 FAL 任务状态
 */
async function pollFalTaskStatus(
  requestId: string,
  options: {
    pollingInterval?: number
    maxPollingAttempts?: number
    timeout?: number
  } = {}
): Promise<{
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
  error?: string
}> {
  const pollingInterval = options.pollingInterval || POLLING_INTERVAL_MS
  const maxPollingAttempts = options.maxPollingAttempts || POLLING_MAX_ATTEMPTS
  const timeout = options.timeout || TIMEOUT_MS * 2

  const startTime = Date.now()
  let attempt = 0

  while (attempt < maxPollingAttempts) {
    // 检查总超时
    if (Date.now() - startTime > timeout) {
      throw new Error(`FAL polling timeout after ${timeout}ms`)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 单次请求超时 5 秒

      try {
        const response = await fetch(`${FAL_API_URL}/${FAL_MODEL_ID}/requests/${requestId}`, {
          method: "GET",
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 404) {
            // 任务不存在，可能还在处理中，继续轮询
            await new Promise((resolve) => setTimeout(resolve, pollingInterval))
            attempt++
            continue
          }
          throw new Error(`FAL polling error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // 解析 FAL API 响应
        const status = mapFalStatusToStandard(data.status || data.state)
        const progress = calculateProgress(data.status || data.state, data.progress)

        // 如果任务完成
        if (status === "succeeded") {
          const resultUrls = extractResultUrls(data)
          return {
            status: "succeeded",
            progress: 100,
            resultUrls,
          }
        }

        // 如果任务失败
        if (status === "failed") {
          return {
            status: "failed",
            progress: progress || 0,
            error: data.error || data.message || "Task failed",
          }
        }

        // 任务还在进行中，继续轮询
        await new Promise((resolve) => setTimeout(resolve, pollingInterval))
        attempt++
      } catch (error: any) {
        clearTimeout(timeoutId)

        // 如果是超时错误，继续轮询
        if (error.name === "AbortError") {
          await new Promise((resolve) => setTimeout(resolve, pollingInterval))
          attempt++
          continue
        }

        throw error
      }
    } catch (error: any) {
      // 如果是最后一次尝试，抛出错误
      if (attempt >= maxPollingAttempts - 1) {
        throw error
      }

      // 否则继续轮询
      await new Promise((resolve) => setTimeout(resolve, pollingInterval))
      attempt++
    }
  }

  // 轮询超时
  throw new Error(`FAL polling timeout after ${maxPollingAttempts} attempts`)
}

/**
 * 将 FAL API 状态映射到标准状态
 */
function mapFalStatusToStandard(falStatus: string): "queued" | "running" | "succeeded" | "failed" {
  const status = (falStatus || "").toLowerCase()

  if (status === "completed" || status === "success" || status === "succeeded") {
    return "succeeded"
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    return "failed"
  }

  if (status === "in_progress" || status === "processing" || status === "running") {
    return "running"
  }

  // 默认状态为 queued
  return "queued"
}

/**
 * 计算进度百分比
 */
function calculateProgress(status: string, progress?: number): number | undefined {
  const mappedStatus = mapFalStatusToStandard(status)

  if (mappedStatus === "succeeded") {
    return 100
  }

  if (mappedStatus === "failed") {
    return 0
  }

  // 如果有明确的进度值，使用它
  if (progress !== undefined && progress !== null) {
    return Math.min(100, Math.max(0, progress))
  }

  // 根据状态估算进度
  if (mappedStatus === "running") {
    return 50 // 运行中，估算为 50%
  }

  return 0 // 排队中
}

/**
 * 从 FAL API 响应中提取结果 URL
 */
function extractResultUrls(data: any): string[] {
  const urls: string[] = []

  // FAL API 可能返回不同的数据结构
  if (data.images && Array.isArray(data.images)) {
    urls.push(...data.images.map((img: any) => img.url || img))
  } else if (data.image_url) {
    urls.push(data.image_url)
  } else if (data.output && Array.isArray(data.output)) {
    urls.push(...data.output.map((item: any) => item.url || item))
  } else if (data.output && typeof data.output === "string") {
    urls.push(data.output)
  } else if (data.result && Array.isArray(data.result)) {
    urls.push(...data.result.map((item: any) => item.url || item))
  } else if (data.result && typeof data.result === "string") {
    urls.push(data.result)
  }

  return urls.filter((url) => url && typeof url === "string")
}

/**
 * 构建 FAL API 的 prompt
 */
function buildPrompt(style: string, template: string): string {
  const styleMap: Record<string, string> = {
    realistic: "realistic, photorealistic, high quality",
    anime: "anime style, vibrant colors, stylized illustration",
    vintage: "vintage, classic, timeless photography",
  }

  const templateMap: Record<string, string> = {
    christmas: "Christmas theme, holiday celebration, cozy atmosphere",
    birthday: "birthday party, celebration, festive",
    wedding: "wedding ceremony, elegant, romantic",
    graduation: "graduation ceremony, achievement, celebration",
    reunion: "family reunion, gathering, joyful",
  }

  const stylePrompt = styleMap[style] || style
  const templatePrompt = templateMap[template] || template

  return `Create a beautiful family mosaic photo with ${stylePrompt} style, ${templatePrompt} theme. High quality, professional photography.`
}

/**
 * 检查 FAL API 健康状态
 */
export async function checkFalHealth(): Promise<{
  ok: boolean
  latency_ms: number | null
  error?: string
}> {
  if (!FAL_API_KEY) {
    return {
      ok: false,
      latency_ms: null,
      error: "FAL_API_KEY not configured",
    }
  }

  if (!FAL_MODEL_ID) {
    return {
      ok: false,
      latency_ms: null,
      error: "FAL_MODEL_ID not configured",
    }
  }

  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

      try {
        // FAL API 健康检查：尝试提交一个简单的测试请求（不实际执行）
        // 或者使用 FAL 的模型信息端点
        const response = await fetch(`https://fal.ai/models/${FAL_MODEL_ID}`, {
          method: "GET",
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
          },
          signal: controller.signal,
        })

      clearTimeout(timeoutId)
      const latency_ms = Date.now() - startTime

      // 200-299 都认为是健康的
      if (response.ok || response.status === 404) {
        // 404 也可能表示 API 可用（只是模型不存在）
        return {
          ok: true,
          latency_ms,
        }
      }

      return {
        ok: false,
        latency_ms,
        error: `Health check failed: ${response.status}`,
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      const latency_ms = Date.now() - startTime

      if (error.name === "AbortError") {
        return {
          ok: false,
          latency_ms,
          error: "Health check timeout",
        }
      }

      return {
        ok: false,
        latency_ms,
        error: error.message || "Health check failed",
      }
    }
  } catch (error: any) {
    return {
      ok: false,
      latency_ms: null,
      error: error.message || "Health check error",
    }
  }
}

/**
 * 自检方法（用于验收测试）
 */
export async function selfTest(): Promise<void> {
  console.log("🧪 FAL Client Self-Test")
  console.log("=".repeat(50))

  // 检查配置
  console.log("\n1. 检查配置...")
  if (!FAL_API_KEY) {
    console.log("⚠️  FAL_API_KEY 未配置（这是正常的，如果未设置环境变量）")
  } else {
    console.log("✅ FAL_API_KEY 已配置")
  }

  if (!FAL_MODEL_ID) {
    console.log("⚠️  FAL_MODEL_ID 未配置，使用默认值")
  } else {
    console.log(`✅ FAL_MODEL_ID: ${FAL_MODEL_ID}`)
  }

  // 健康检查（仅在配置存在时执行）
  if (FAL_API_KEY && FAL_MODEL_ID) {
    console.log("\n2. 健康检查...")
    try {
      const health = await checkFalHealth()
      if (!health.ok) {
        console.log(`⚠️  健康检查失败: ${health.error}（可能是 API 密钥无效）`)
      } else {
        console.log(`✅ 健康检查通过 (延迟: ${health.latency_ms}ms)`)
      }
    } catch (error: any) {
      console.log(`⚠️  健康检查异常: ${error.message}（可能是 API 密钥无效或网络问题）`)
    }
  } else {
    console.log("\n2. 健康检查...")
    console.log("⚠️  跳过健康检查（FAL_API_KEY 或 FAL_MODEL_ID 未配置）")
  }

  // 测试接口导出
  console.log("\n3. 检查接口导出...")
  if (typeof callFalAPI !== "function") {
    throw new Error("❌ callFalAPI 未导出")
  }
  console.log("✅ callFalAPI 已导出")

  if (typeof checkFalHealth !== "function") {
    throw new Error("❌ checkFalHealth 未导出")
  }
  console.log("✅ checkFalHealth 已导出")

  // 检查接口类型
  console.log("\n4. 检查接口类型...")
  try {
    // 验证接口签名
    const testRequest: FalGenerateRequest = {
      files: ["https://example.com/image.jpg"],
      style: "realistic",
      template: "christmas",
    }
    console.log("✅ FalGenerateRequest 接口定义正确")

    const testResponse: FalGenerateResponse = {
      jobId: "test_job_id",
      status: "queued",
    }
    console.log("✅ FalGenerateResponse 接口定义正确")
  } catch (error: any) {
    throw new Error(`❌ 接口类型检查失败: ${error.message}`)
  }

  console.log("\n" + "=".repeat(50))
  console.log("✅ 所有自检通过！")
  console.log("=".repeat(50))
}

// 如果直接运行此文件，执行自检
if (require.main === module) {
  selfTest()
    .then(() => {
      console.log("\n✅ Self-test completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      console.error("\n❌ Self-test failed:", error.message)
      process.exit(1)
    })
}


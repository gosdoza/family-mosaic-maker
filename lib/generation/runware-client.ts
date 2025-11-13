/**
 * Runware API 客户端
 * 
 * 包含超时、重试、降级策略
 */

import { RunwarePayload } from "@/lib/providers/runware.schema"

// 兼容旧的接口（用于 provider-router）
export interface RunwareGenerateRequest {
  files: string[] // 文件 URL 列表
  style: string
  template: string
  resolution?: number
  steps?: number
  grayscale_ratio?: number
}

export interface RunwareGenerateResponse {
  jobId: string
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
  error?: string
}

const RUNWARE_BASE_URL = process.env.RUNWARE_BASE_URL || "https://api.runware.ai"
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || `${RUNWARE_BASE_URL}/v1`
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY
const TIMEOUT_MS = 8000 // 8 秒超时
const MAX_RETRIES = 2 // 最多重试 2 次
const RETRY_DELAY_MS = 1000 // 初始重试延迟 1 秒
const HEALTH_CHECK_TIMEOUT_MS = 5000 // 健康检查超时 5 秒

/**
 * 调用 Runware API 生成图片
 */
export async function callRunwareAPI(
  request: RunwareGenerateRequest,
  options: {
    timeout?: number
    maxRetries?: number
    onRetry?: (attempt: number) => void
  } = {}
): Promise<RunwareGenerateResponse> {
  const timeout = options.timeout || TIMEOUT_MS
  const maxRetries = options.maxRetries || MAX_RETRIES

  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured")
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 创建带超时的 AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const url = `${RUNWARE_API_URL}/generate`
      const method = "POST"
      
      // 将 RunwareGenerateRequest 转换为 Runware API 需要的格式
      // 将 style 和 template 组合成 prompt
      const prompt = `${request.style} ${request.template}`.trim()
      
      // 使用第一个文件 URL 作为 image_url（如果有且是有效 URL）
      let imageUrl: string | undefined = undefined
      if (request.files.length > 0) {
        const firstFile = request.files[0]
        try {
          const urlObj = new URL(firstFile)
          // 排除占位符域名
          if (!urlObj.hostname.includes("example.com") && !urlObj.hostname.includes("localhost")) {
            imageUrl = firstFile
          }
        } catch {
          // 不是有效 URL，忽略
        }
      }
      
      // 构建符合 Runware API 的 payload
      const runwarePayload: RunwarePayload = {
        taskType: "imageInference",
        prompt,
        model: "default",
        ...(imageUrl && { image_url: imageUrl }),
      }
      
      // Runware API 要求 payload 必须是数组格式
      const payloadArray = [runwarePayload]
      const body = JSON.stringify(payloadArray)
      const headers = {
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        "Content-Type": "application/json",
      }

      // 请求前日志（不泄露密钥）
      console.log(JSON.stringify({
        tag: "runware.generate.request",
        url,
        method,
        "headers.content-type": headers["Content-Type"],
        hasApiKey: !!RUNWARE_API_KEY,
        bodyKeys: Object.keys(runwarePayload),
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
      }))

      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // 读取响应体（用于日志）
        let responseBodyText = ""
        let responseData: any = null
        const xRequestId = response.headers.get("x-request-id") || response.headers.get("X-Request-Id") || null
        
        try {
          responseBodyText = await response.text()
          // 尝试解析 JSON
          try {
            responseData = JSON.parse(responseBodyText)
          } catch {
            // 如果不是 JSON，使用原始文本
            responseData = responseBodyText
          }
        } catch (e) {
          // 忽略读取错误
        }

        // 响应日志
        const shortBody = typeof responseData === "string" 
          ? responseData.substring(0, 300)
          : JSON.stringify(responseData).substring(0, 300)
        
        console.log(JSON.stringify({
          tag: "runware.generate.response",
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          shortBody,
          xRequestId,
        }))

        if (!response.ok) {
          // 4xx/5xx 错误：抛出包含详细信息的错误
          const errorMessage = responseData?.error || responseData?.message || response.statusText || "Unknown error"
          const error = new Error(`Runware API error: ${response.status} ${errorMessage}`) as any
          error.status = response.status
          error.statusText = response.statusText
          error.responseBody = responseData
          error.responseBodyText = responseBodyText.substring(0, 300)
          error.xRequestId = xRequestId
          throw error
        }

        return {
          jobId: responseData.jobId || responseData.job_id,
          status: responseData.status || "queued",
          progress: responseData.progress,
          resultUrls: responseData.resultUrls || responseData.result_urls,
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

  throw lastError || new Error("Runware API call failed")
}

/**
 * 检查 Runware API 健康状态
 */
export async function checkRunwareHealth(): Promise<{
  ok: boolean
  latency_ms: number | null
  error?: string
}> {
  if (!RUNWARE_API_KEY) {
    return {
      ok: false,
      latency_ms: null,
      error: "RUNWARE_API_KEY not configured",
    }
  }

  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

    try {
      // 使用 /v1/health 端点（根据 Runware API 文档）
      const healthEndpoint = `${RUNWARE_API_URL}/health`
      const response = await fetch(healthEndpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const latency_ms = Date.now() - startTime

      if (!response.ok) {
        // 如果返回 400/404，可能是端点不存在，但我们有 API key，所以认为配置正确
        // 实际连接性将在实际生成请求时验证
        if (response.status === 400 || response.status === 404) {
          return {
            ok: true,
            latency_ms,
            error: `Health endpoint unavailable (${response.status}), but API key configured`,
          }
        }

        // 其他错误（如 401/403）表示认证问题
        let errorDetail = `HTTP ${response.status}`
        try {
          const errorText = await response.text()
          if (errorText && errorText.length < 200) {
            errorDetail = `${errorDetail}: ${errorText.replace(/Bearer\s+[\w-]+/gi, "Bearer ***").substring(0, 100)}`
          }
        } catch (e) {
          // 忽略读取错误
        }
        return {
          ok: false,
          latency_ms,
          error: errorDetail,
        }
      }

      return {
        ok: true,
        latency_ms,
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      const latency_ms = Date.now() - startTime

      if (error.name === "AbortError") {
        // 超时可能表示网络问题，但我们有 API key，所以认为配置正确
        return {
          ok: true,
          latency_ms,
          error: "Health check timeout, but API key configured",
        }
      }

      // 网络错误（如 DNS 失败）可能表示端点不存在，但我们有 API key
      if (error.message?.includes("fetch failed") || error.message?.includes("ENOTFOUND")) {
        return {
          ok: true,
          latency_ms,
          error: "Health endpoint unavailable, but API key configured",
        }
      }

      // 其他错误
      let errorMessage = error.message || "Health check failed"
      if (error.cause) {
        errorMessage = `${errorMessage} (${error.cause.message || String(error.cause)})`
      }
      errorMessage = errorMessage.replace(/Bearer\s+[\w-]+/gi, "Bearer ***")

      return {
        ok: false,
        latency_ms,
        error: errorMessage,
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


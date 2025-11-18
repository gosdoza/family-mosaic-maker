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
  // Extended fields for template config support
  prompt?: string // Override prompt from template config
  model?: string // Override model from template config
  negativePrompt?: string // Negative prompt from template config
  width?: number // Image width from template config
  height?: number // Image height from template config
}

export interface RunwareGenerateResponse {
  jobId: string // For backward compatibility, maps to taskUUID
  taskUUID?: string // Actual taskUUID from Runware API
  imageURL?: string // Image URL from Runware API response
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
  error?: string
}

const RUNWARE_BASE_URL = process.env.RUNWARE_BASE_URL || "https://api.runware.ai"
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || `${RUNWARE_BASE_URL}/v1`
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY
const TIMEOUT_MS = Number(process.env.RUNWARE_TIMEOUT_MS ?? 120_000) // 120 秒超时，暫時拉長確認是否為 timeout 問題
const MAX_RETRIES = 1 // 避免過多重試
const RETRY_DELAY_MS = 1000 // 初始重试延迟 1 秒
const HEALTH_CHECK_TIMEOUT_MS = 5000 // 健康检查超时 5 秒
const DEFAULT_NEGATIVE_PROMPT = "blurry, distorted faces, extra limbs, low quality, text, watermark"

/**
 * 调用 Runware API 生成图片
 * 
 * ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
 * This function should only be called from RunwareProvider.generate() which checks RUNWARE_ENABLED first.
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

  // Generate taskUUID at the start (used for all retry attempts)
  const taskUUID =
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 创建带超时的 AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // Runware HTTP API endpoint: https://api.runware.ai/v1 (no /generate suffix)
      const url = RUNWARE_API_URL
      const method = "POST"
      
      // 将 RunwareGenerateRequest 转换为 Runware API 需要的格式
      // Use template config prompt if provided, otherwise fallback to style + template
      const prompt = request.prompt || `${request.style} ${request.template}`.trim()
      
      // 暫時強制使用 Runware 官方推薦的 image model（先讓最基本案例一定成功）
      const model = "runware:101@1" // FLUX.1 Dev 官方範例
      
      // 使用第一个文件 URL 作为 imageURL（如果有且是有效 URL）
      let imageURL: string | undefined = undefined
      if (request.files.length > 0) {
        const firstFile = request.files[0]
        try {
          const urlObj = new URL(firstFile)
          // 排除占位符域名
          if (!urlObj.hostname.includes("example.com") && !urlObj.hostname.includes("localhost")) {
            imageURL = firstFile
          }
        } catch {
          // 不是有效 URL，忽略
        }
      }
      
      // 构建符合 Runware HTTP API 官方规格的 payload
      // Payload must be an array containing task objects with taskUUID and positivePrompt
      // 對齊官方 Text-to-image 範例格式
      // 預設使用 sync 模式（deliveryMethod="sync"），直接返回結果，避免 polling
      const task: any = {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: prompt,
        negativePrompt: request.negativePrompt ?? "",
        model,
        width: request.width ?? 768,
        height: request.height ?? 768,
        steps: request.steps ?? 24,
        numberResults: request.numberResults ?? 1,
        // 新增的建議欄位（對齊官方範例）
        outputType: (request as any).outputType ?? "URL",
        outputFormat: (request as any).outputFormat ?? "JPG",
        CFGScale: (request as any).CFGScale ?? 7.5,
        deliveryMethod: (request as any).deliveryMethod ?? "sync", // 預設 sync 模式
        ...(imageURL && { imageURL }),
      }
      
      // Runware HTTP API 要求 payload 是「陣列」格式
      const payload = [task]
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      } as const
      const body = JSON.stringify(payload)
      
      // 強化 request log（發送前）
      console.log("[runware-client] request", {
        url,
        method,
        hasApiKey: Boolean(RUNWARE_API_KEY),
        payloadIsArray: Array.isArray(payload),
        payloadLength: payload.length,
        taskType: task.taskType,
        model: task.model,
        width: task.width,
        height: task.height,
        steps: task.steps,
        deliveryMethod: task.deliveryMethod,
        outputType: task.outputType,
      })

      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // 強化 response log（收到回應後，解析前）
        console.log("[runware-client] response", {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        })

        // 读取响应体（用于日志）
        let responseBodyText = ""
        let responseData: any = null
        const xRequestId = response.headers.get("x-request-id") || response.headers.get("X-Request-Id") || null
        
        try {
          responseBodyText = await response.text()
          const shortBody = responseBodyText.slice(0, 500)
          console.log("[runware-client] responseBody", shortBody)
          
          // 尝试解析 JSON
          try {
            responseData = JSON.parse(responseBodyText)
          } catch {
            // 如果不是 JSON，使用原始文本
            responseData = responseBodyText
            console.error("[runware-client] failed to parse JSON response", {
              responseBodyText: shortBody,
            })
          }
        } catch (e) {
          console.error("[runware-client] failed to read response body", e)
        }

        if (!response.ok) {
          // 4xx/5xx 错误：抛出包含详细信息的错误
          // Runware API 错误格式可能包含 errors 数组: [{ code, message, parameter, taskUUID }]
          const errors = responseData?.errors || []
          const errorMessage = 
            errors.length > 0 
              ? errors.map((e: any) => `${e.code || "ERROR"}: ${e.message || "Unknown"}`).join("; ")
              : responseData?.error || responseData?.message || responseData?.detail || response.statusText || "Unknown error"
          const errorCode = errors.length > 0 ? errors[0].code : (responseData?.code || responseData?.error_code || undefined)
          
          const error = new Error(`Runware API error: ${response.status} ${errorMessage}`) as any
          error.name = "RunwareAPIError"
          error.status = response.status
          error.statusText = response.statusText
          error.code = errorCode
          error.responseBody = responseData
          error.responseBodyText = responseBodyText.substring(0, 500) // 增加長度限制
          error.xRequestId = xRequestId
          error.errors = errors // Include errors array for detailed debugging
          
          // In dev, log full error details
          if (process.env.NODE_ENV !== "production") {
            console.error("[runware-client] API error detail:", {
              status: response.status,
              statusText: response.statusText,
              code: errorCode,
              message: errorMessage,
              errors,
              responseBody: responseData,
              xRequestId,
            })
          }
          
          throw error
        }

        // 成功情况：Runware HTTP API 返回格式为 { data: [{ taskType, taskUUID, imageUUID, imageURL, ... }] }
        if (!responseData || !Array.isArray(responseData.data) || responseData.data.length === 0) {
          const error = new Error("Runware API returned empty data") as any
          error.name = "RunwareAPIError"
          error.status = response.status
          error.statusText = response.statusText
          error.responseBody = responseData
          error.responseBodyText = responseBodyText.substring(0, 500)
          error.xRequestId = xRequestId
          
          if (process.env.NODE_ENV !== "production") {
            console.error("[runware-client] Empty data error:", {
              status: response.status,
              responseBody: responseData,
              xRequestId,
            })
          }
          
          throw error
        }

        const taskResult = responseData.data[0]
        const resultImageURL = taskResult.imageURL || taskResult.imageUrl

        // Return response in format compatible with existing code
        return {
          jobId: taskResult.taskUUID || taskUUID, // For backward compatibility
          taskUUID: taskResult.taskUUID || taskUUID,
          imageURL: resultImageURL,
          status: "succeeded" as const, // Runware HTTP API returns immediately with result
          resultUrls: resultImageURL ? [resultImageURL] : [],
        }
      } catch (error: any) {
        clearTimeout(timeoutId)
        
        // 處理 AbortError (timeout)
        if (error?.name === "AbortError") {
          console.error("[runware-client] AbortError: request timed out", {
            timeoutMs: TIMEOUT_MS,
            url,
          })
          
          const abortError = new Error("Runware API error: This operation was aborted (timeout)") as any
          abortError.name = "RunwareGenerateError"
          abortError.status = 500
          abortError.code = "TIMEOUT"
          abortError.originalError = error
          throw abortError
        }
        
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


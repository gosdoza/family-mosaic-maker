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

// 三、修正 Runware generic flow 使用錯誤 model：建立統一的 model 常數
const RUNWARE_DEFAULT_MODEL = "runware:101@1"
const RUNWARE_FALLBACK_MODEL = "runware:102@1"

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
      
      // 三、修正 Runware generic flow 使用錯誤 model
      // Step 2: Use faster model and settings for fallback imageInference to avoid timeouts
      // Check if this is a fallback call (no files means it's likely a fallback from identity flow)
      const isFallback = request.files.length === 0
      
      // 使用統一的 model 常數，避免使用 google:4@1 等不支援 steps 的模型
      let model = request.model || RUNWARE_DEFAULT_MODEL
      
      // 如果 model 是 google:* 類型，強制使用預設模型（因為 google 模型不支援 steps）
      if (model.startsWith("google:")) {
        console.warn("[runware-client] Detected google:* model, replacing with default model (google models don't support 'steps' parameter)", {
          originalModel: model,
          replacedWith: isFallback ? RUNWARE_FALLBACK_MODEL : RUNWARE_DEFAULT_MODEL,
        })
        model = isFallback ? RUNWARE_FALLBACK_MODEL : RUNWARE_DEFAULT_MODEL
      } else if (isFallback) {
        // Fallback 時使用更快的模型
        model = RUNWARE_FALLBACK_MODEL
      }
      
      // 使用第一个文件 URL 作为 imageURL（如果有且是有效 URL）
      // 注意：Runware API 的 imageInference 可能支持 imageURL 参数用于 image-to-image
      // 如果是 text-to-image，不需要 imageURL
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
      
      // R1: 構建符合 Runware HTTP API 官方規格的 payload
      // Final request body shape (R1): JSON array of tasks, e.g. [ { taskType: "imageInference", taskUUID: "...", positivePrompt: "...", ... } ]
      // Runware API 要求 request body 是純陣列格式，每個 element 是一個 task 物件
      // 預設使用 sync 模式（deliveryMethod="sync"），直接返回結果，避免 polling
      // Step 2: Use faster settings for fallback to avoid timeouts
      // 三、修正 Runware generic flow：防禦性處理，google 模型不支援 steps
      const steps = isFallback ? 18 : (request.steps ?? 24)
      const width = isFallback ? 768 : (request.width ?? 768)
      const height = isFallback ? 768 : (request.height ?? 768)
      
      const task: any = {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: prompt,
        negativePrompt: request.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
        model,
        width,
        height,
        numberResults: request.numberResults ?? 1,
        // 新增的建議欄位（對齊官方範例）
        outputType: (request as any).outputType ?? "URL",
        outputFormat: (request as any).outputFormat ?? "JPG",
        CFGScale: (request as any).CFGScale ?? 7.5,
        deliveryMethod: (request as any).deliveryMethod ?? "sync", // Step 2: Keep sync for fallback
        // 只有在有有效 imageURL 時才添加（用於 image-to-image）
        ...(imageURL && { imageURL }),
      }
      
      // 三、修正 Runware generic flow：只有非 google 模型才設定 steps
      // 防禦性處理：如果 model 是 google:* 類型，不設定 steps（google 模型不支援 steps 參數）
      if (!model.startsWith("google:")) {
        task.steps = steps
      } else {
        console.warn("[runware-client] Skipping 'steps' parameter for google:* model (not supported)", {
          model,
        })
      }
      
      // R1: Runware HTTP API 要求 request body 是純陣列格式 [task1, task2, ...]
      // Response 格式是 { data: [...] }，但 request 必須是純陣列
      const payload = [task]
      
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      } as const
      const body = JSON.stringify(payload)
      
      // R1-STEP1: 強化 request log（發送前）- 打印完整的 JSON body（不包含 API key）
      // 創建一個安全的 payload 副本用於 log（移除敏感信息）
      const safeTaskForLog = {
        ...task,
        ...(imageURL && { imageURL: imageURL.substring(0, 100) + "..." }), // 只顯示前 100 字符
      }
      const safePayloadForLog = [safeTaskForLog]
      
      // R1-STEP1: 詳細的 request log
      console.log("[runware-client] R1-STEP1: request details", {
        url,
        method,
        hasApiKey: Boolean(RUNWARE_API_KEY),
        payloadStructure: "array of tasks",
        payloadIsArray: Array.isArray(payload),
        payloadLength: payload.length,
        taskType: task.taskType,
        model: task.model,
        width: task.width,
        height: task.height,
        steps: task.steps,
        deliveryMethod: task.deliveryMethod,
        outputType: task.outputType,
        taskUUID: task.taskUUID,
        positivePrompt: task.positivePrompt?.substring(0, 100) + (task.positivePrompt?.length > 100 ? "..." : ""),
        negativePrompt: task.negativePrompt?.substring(0, 50) + (task.negativePrompt?.length > 50 ? "..." : ""),
        hasImageURL: Boolean(imageURL),
      })
      // R1-STEP1: 打印完整的 JSON body（不包含 API key）
      console.log("[runware-client] R1-STEP1: request JSON body (full structure):", JSON.stringify(safePayloadForLog, null, 2))
      // R1-STEP1: 打印實際要發送的 body 字符串長度（用於驗證）
      console.log("[runware-client] R1-STEP1: request body string length:", body.length, "bytes")

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
          // Runware API 错误格式可能包含 errors 数组: [{ code, message, parameter, taskUUID, allowedValues, ... }]
          const errors = responseData?.errors || []
          const errorMessage = 
            errors.length > 0 
              ? errors.map((e: any) => `${e.code || "ERROR"}: ${e.message || "Unknown"}`).join("; ")
              : responseData?.error || responseData?.message || responseData?.detail || response.statusText || "Unknown error"
          const errorCode = errors.length > 0 ? errors[0].code : (responseData?.code || responseData?.error_code || undefined)
          
          // R1: 詳細記錄錯誤信息（包含 code、message、allowedValues 等）
          console.error("[runware-client] R1-STEP1: API error response", {
            status: response.status,
            statusText: response.statusText,
            code: errorCode,
            message: errorMessage,
            errors: errors.map((e: any) => ({
              code: e.code,
              message: e.message,
              parameter: e.parameter,
              taskUUID: e.taskUUID,
              allowedValues: e.allowedValues,
            })),
            responseBody: responseData,
            responseBodyText: responseBodyText.substring(0, 1000), // 增加長度以便看到完整錯誤
            xRequestId,
          })
          
          const error = new Error(`Runware API error: ${response.status} ${errorMessage}`) as any
          error.name = "RunwareAPIError"
          error.status = response.status
          error.statusText = response.statusText
          error.code = errorCode
          error.responseBody = responseData
          error.responseBodyText = responseBodyText.substring(0, 1000) // 增加長度限制
          error.xRequestId = xRequestId
          error.errors = errors // Include errors array for detailed debugging
          
          // 拋出錯誤，讓上層 /api/generate 的 try/catch 負責 fallback 到 Mock
          throw error
        }

        // R1-STEP1: 成功情況：Runware HTTP API 返回格式為 { data: [{ taskType, taskUUID, imageUUID, imageURL, ... }] }
        // R1-STEP1: 加強 response 結構驗證和 log
        console.log("[runware-client] R1-STEP1: response structure check", {
          hasResponseData: Boolean(responseData),
          responseDataType: typeof responseData,
          hasDataField: Boolean(responseData?.data),
          dataIsArray: Array.isArray(responseData?.data),
          dataLength: responseData?.data?.length || 0,
          responseDataKeys: responseData ? Object.keys(responseData) : [],
        })
        
        if (!responseData || !Array.isArray(responseData.data) || responseData.data.length === 0) {
          const error = new Error("Runware API returned empty data") as any
          error.name = "RunwareAPIError"
          error.status = response.status
          error.statusText = response.statusText
          error.responseBody = responseData
          error.responseBodyText = responseBodyText.substring(0, 500)
          error.xRequestId = xRequestId
          
          console.error("[runware-client] R1-STEP1: Empty data error:", {
            status: response.status,
            responseBody: responseData,
            responseBodyText: responseBodyText.substring(0, 500),
            xRequestId,
          })
          
          throw error
        }

        const taskResult = responseData.data[0]
        // R1-STEP1: 嘗試多種可能的字段名稱來提取 imageURL
        const resultImageURL = taskResult.imageURL || taskResult.imageUrl || taskResult.resultUrl || taskResult.result_url || taskResult.image_url
        
        // R1-STEP1: 詳細的 response log（成功時）
        console.log("[runware-client] R1-STEP1: response parsed successfully", {
          taskResultKeys: Object.keys(taskResult),
          taskUUID: taskResult.taskUUID,
          hasImageURL: Boolean(resultImageURL),
          imageURL: resultImageURL ? resultImageURL.substring(0, 150) + (resultImageURL.length > 150 ? "..." : "") : null,
          imageURLLength: resultImageURL?.length || 0,
          taskType: taskResult.taskType,
          status: taskResult.status,
          // R1-STEP1: 列出所有可能的 image URL 字段
          allImageFields: {
            imageURL: taskResult.imageURL,
            imageUrl: taskResult.imageUrl,
            resultUrl: taskResult.resultUrl,
            result_url: taskResult.result_url,
            image_url: taskResult.image_url,
          },
        })
        
        // R1-STEP1: 如果成功取得 imageURL，特別標記
        if (resultImageURL) {
          console.log("[runware-client] R1-STEP1: ✅ Successfully extracted imageURL:", resultImageURL.substring(0, 200))
        } else {
          console.warn("[runware-client] R1-STEP1: ⚠️ No imageURL found in response, available fields:", Object.keys(taskResult))
        }

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
 * Step 1: Helper to fetch image and convert to base64
 * 
 * Downloads an image from URL and converts it to base64 data URI.
 * 
 * @param url - Image URL to fetch
 * @returns Promise with base64 data URI string (data:image/*;base64,...)
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  // T3 Hotfix: 確保使用完整 URL，只在 log 中截斷
  const fullUrl = url
  const shortUrl = fullUrl.length > 100 
    ? fullUrl.substring(0, 100) + "..." 
    : fullUrl
  const isSupabaseUrl = fullUrl.startsWith("https://") && 
    (fullUrl.includes("supabase.co/storage/v1/object/public/") || 
     fullUrl.includes("mxdexoahfmwbqwngzzsf.supabase.co"))

  try {
    console.log("[runware-client] Step1: Fetching image for base64 conversion", {
      url: shortUrl,
      urlLength: fullUrl.length,
      urlStartsWith: fullUrl.substring(0, 60),
      isSupabaseUrl,
    })

    // T3 Hotfix: 使用完整 URL 進行 fetch
    const response = await fetch(fullUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64String = buffer.toString("base64")

    // Detect content type from response headers or default to image/jpeg
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const dataUri = `data:${contentType};base64,${base64String}`

    console.log("[runware-client] Step1: Image converted to base64", {
      url: shortUrl,
      urlLength: fullUrl.length,
      contentType,
      base64Length: base64String.length,
      dataUriLength: dataUri.length,
    })

    return dataUri
  } catch (error: any) {
    // T3 Hotfix: Log 中使用截斷版本，但保留完整 URL 在錯誤訊息中
    console.error("[runware-client] Step1: Failed to fetch/convert image to base64", {
      error: error.message,
      url: shortUrl,
      urlLength: fullUrl.length,
      urlStartsWith: fullUrl.substring(0, 60),
      fullUrl: fullUrl, // 在錯誤 log 中保留完整 URL 以便 debug
    })
    throw error
  }
}

/**
 * Task C1: Runware Image Upload Helper
 * 
 * Uploads an image to Runware and returns the imageUUID for use as identity reference.
 * 
 * Step 1 Fix: Identity upload MUST use base64-encoded image string, NOT a URL.
 * 
 * @param imageSource - URL of the source image to upload (will be converted to base64)
 * @returns Promise with imageUUID and taskUUID from Runware
 */
export interface RunwareImageUploadResult {
  imageUUID: string
  taskUUID: string
}

export async function runRunwareImageUpload(imageSource: string): Promise<RunwareImageUploadResult> {
  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured")
  }

  const taskUUID =
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  // Step 1: Detect if imageSource is a URL and convert to base64
  let base64Image: string = imageSource

  // Check if imageSource is already a base64 data URI
  const isDataUri = imageSource.startsWith("data:image/")
  const isUrl = !isDataUri && (imageSource.startsWith("http://") || imageSource.startsWith("https://"))

  if (isUrl) {
    try {
      base64Image = await fetchImageAsBase64(imageSource)
    } catch (error: any) {
      const runwareError = new Error(`Failed to convert image URL to base64: ${error.message}`) as any
      runwareError.name = "RunwareAPIError"
      runwareError.originalError = error
      runwareError.imageSource = imageSource.substring(0, 100)
      throw runwareError
    }
  } else if (!isDataUri) {
    // If it's not a URL and not a data URI, assume it's already base64 (without data: prefix)
    // Add data URI prefix if missing
    if (!imageSource.includes(";base64,")) {
      base64Image = `data:image/jpeg;base64,${imageSource}`
    }
  }

  // Step 1: Payload with base64 image and outputFormat
  const task: any = {
    taskType: "imageUpload",
    taskUUID,
    image: base64Image, // Step 1: Use base64 string instead of URL
    outputFormat: "PNG",
  }

  const payload = [task]
  const url = RUNWARE_API_URL
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RUNWARE_API_KEY}`,
  } as const
  const body = JSON.stringify(payload)

  // T3 Hotfix: 確保 log 中顯示完整 URL 資訊，但實際傳遞的是完整 imageSource
  const shortImageSource = imageSource.length > 100 
    ? imageSource.substring(0, 100) + "..." 
    : imageSource
  const isSupabaseUrl = imageSource.startsWith("https://") && 
    (imageSource.includes("supabase.co/storage/v1/object/public/") || 
     imageSource.includes("mxdexoahfmwbqwngzzsf.supabase.co"))

  console.log("[runware-client] C1: imageUpload request", {
    url,
    taskType: task.taskType,
    taskUUID,
    imageSource: shortImageSource,
    imageSourceLength: imageSource.length,
    imageSourceStartsWith: imageSource.substring(0, 60),
    isUrl,
    isDataUri,
    isSupabaseUrl,
    base64Length: base64Image.length,
    outputFormat: task.outputFormat,
  })

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Runware imageUpload API error: ${response.status} ${errorText.substring(0, 200)}`) as any
      error.name = "RunwareAPIError"
      error.status = response.status
      error.responseBody = errorText.substring(0, 500)
      error.imageSource = imageSource.substring(0, 100)
      throw error
    }

    const responseData = await response.json()

    // Task C1: 解析 response，同時容忍兩種格式（array 或 object）
    // 文件 example 是: { "data": { "taskType": "imageUpload", "taskUUID": "...", "imageUUID": "..." } }
    // 但為了安全，要同時容忍: { "data": [{ ... }] }
    let dataObj: any = null
    if (Array.isArray(responseData.data)) {
      if (responseData.data.length === 0) {
        throw new Error("Runware imageUpload API returned empty data array")
      }
      dataObj = responseData.data[0]
    } else if (responseData.data) {
      dataObj = responseData.data
    } else {
      // 如果沒有 data 欄位，嘗試直接使用 responseData
      dataObj = responseData
    }

    if (!dataObj) {
      throw new Error("Runware imageUpload API returned invalid response structure")
    }

    const imageUUID = dataObj.imageUUID || dataObj.image_uuid

    if (!imageUUID) {
      const error = new Error("Runware imageUpload API did not return imageUUID. Response: " + JSON.stringify(dataObj).substring(0, 200)) as any
      error.name = "RunwareAPIError"
      error.responseBody = responseData
      error.imageSource = imageSource.substring(0, 100)
      throw error
    }

    console.log("[runware-client] C1: imageUpload response", {
      taskUUID,
      imageUUID,
      imageSource: imageSource.substring(0, 100),
    })

    return { imageUUID, taskUUID }
  } catch (error: any) {
    console.error("[runware-client] C1: imageUpload failed", {
      error: error.message,
      errorName: error.name,
      status: error.status,
      imageSource: imageSource.substring(0, 100),
      base64Length: base64Image?.length,
    })
    throw error
  }
}

/**
 * Task C2: Runware Identity Flow Helper (using imageInference + PuLID)
 * 
 * Generates images using imageInference with PuLID identity preservation.
 * 
 * @param params - Identity flow parameters
 * @returns Promise with taskUUID, imageURL, and resultUrls
 */
export interface RunwareIdentityParams {
  taskUUID: string
  positivePrompt: string
  negativePrompt?: string
  width: number
  height: number
  steps: number
  model?: string // 預設 runware:101@1
  imageUUID: string // 從 C1 取得
}

export interface RunwareImageInferenceResult {
  taskUUID: string
  imageURL: string
  resultUrls: string[]
}

export async function runRunwarePhotoMakerWithReference(
  params: RunwareIdentityParams,
): Promise<RunwareImageInferenceResult> {
  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured")
  }

  const {
    taskUUID,
    positivePrompt,
    negativePrompt,
    width,
    height,
    steps,
    model = "runware:101@1",
    imageUUID,
  } = params

  // T4: Identity Payload Fix - 簡化成最小可行的 PuLID 請求
  // 根據 Runware API 錯誤 conflictPuLIDTrueCFG：
  // - puLID.trueCFGScale 和 puLID.CFGStartStep 不能同時設定
  // - 先移除這些進階參數，只保留核心 identity 功能
  const task: any = {
    taskType: "imageInference",
    taskUUID,
    positivePrompt,
    negativePrompt: negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    height,
    width,
    model,
    steps,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "JPG",
    CFGScale: 7.5,
    deliveryMethod: "sync",
    // T4: 最小可行的 PuLID 配置（移除衝突參數）
    // 只保留核心 identity 功能，避免 conflictPuLIDTrueCFG 錯誤
    puLID: {
      inputImages: [imageUUID], // 從 C1 取得的 imageUUID（必要）
      idWeight: 1, // Identity 強度（保留，因為是基本參數）
      // 移除 trueCFGScale、CFGStartStep、CFGStartStrength 以避免衝突
      // 如果未來需要這些參數，請確認 Runware API 文檔的最新規則
    },
  }

  const payload = [task]
  const url = RUNWARE_API_URL
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RUNWARE_API_KEY}`,
  } as const
  const body = JSON.stringify(payload)

  // T4: 在 Identity payload 組裝完成後，新增 log 顯示 puLID 結構
  const puLIDKeys = Object.keys(task.puLID || {})
  console.log("[runware-client] C2: identity imageInference (PuLID)", {
    url,
    taskType: task.taskType,
    taskUUID,
    model,
    imageUUID,
    width,
    height,
    steps,
    hasPuLID: !!task.puLID,
    puLIDKeys, // T4: 只輸出 puLID 的 keys，不輸出完整 base64
    puLID: {
      inputImages: task.puLID.inputImages,
      idWeight: task.puLID.idWeight,
    },
  })

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Runware identity imageInference (PuLID) API error: ${response.status} ${errorText.substring(0, 200)}`) as any
      error.name = "RunwareAPIError"
      error.status = response.status
      error.responseBody = errorText.substring(0, 500)
      throw error
    }

    const responseData = await response.json()

    // Task C2: 沿用 R1 已經實作好的 response parsing
    // Expected: { data: [{ taskType: "imageInference", taskUUID, imageURL, imageUUID, ... }] }
    if (!responseData || !Array.isArray(responseData.data) || responseData.data.length === 0) {
      throw new Error("Runware identity imageInference (PuLID) API returned empty data")
    }

    const taskResult = responseData.data[0]
    // Task C2: 從 response.data[0] 取 taskUUID, imageUUID, imageURL / resultUrls
    const resultImageURL = taskResult.imageURL || taskResult.imageUrl || taskResult.resultUrl || taskResult.result_url
    const resultUrls = resultImageURL ? [resultImageURL] : (taskResult.resultUrls || taskResult.result_urls || [])

    if (!resultImageURL && resultUrls.length === 0) {
      throw new Error("Runware identity imageInference (PuLID) API did not return imageURL or resultUrls")
    }

    console.log("[runware-client] C2: identity imageInference (PuLID) success", {
      taskUUID,
      imageURL: resultImageURL ? resultImageURL.substring(0, 100) + "..." : null,
      resultUrlsCount: resultUrls.length,
    })

    return {
      taskUUID,
      imageURL: resultImageURL || resultUrls[0] || "",
      resultUrls,
    }
  } catch (error: any) {
    console.error("[runware-client] C2: identity imageInference (PuLID) failed", {
      error: error.message,
      errorName: error.name,
      status: error.status,
      imageUUID,
    })
    throw error
  }
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


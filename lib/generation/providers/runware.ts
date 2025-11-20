/**
 * Runware Provider
 * 
 * 實作 Runware API 的 GenerationProvider
 * RUNWARE-NOTE: Uses template config to map (template, style) -> Runware model + prompts
 */

import { GenerationProvider, GenerateRequestPayload, GenerateResult, ProgressResult, ResultsResult } from "./base"
import { callRunwareAPI, RunwareGenerateRequest, runRunwareImageUpload, runRunwarePhotoMakerWithReference } from "../runware-client"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveRunwareTemplate } from "@/lib/templates/runware-templates"
import { isDemoMode, isForceRealGenerate } from "@/lib/featureFlags"

// Task C3: Helper for generating taskUUID (server-side only)
function generateTaskUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY
const RUNWARE_BASE_URL = process.env.RUNWARE_BASE_URL || "https://api.runware.ai"
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || `${RUNWARE_BASE_URL}/v1`

// 總開關：當 RUNWARE_ENABLED=false 時，完全禁用 Runware API 調用
const RUNWARE_ENABLED =
  process.env.RUNWARE_ENABLED !== "false" &&
  process.env.RUNWARE_ENABLED !== "0"

/**
 * 獲取 Supabase Service Client（用於服務端操作）
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase credentials not configured")
  }

  return createServiceClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * 查詢 Runware API 獲取 job 狀態
 * 
 * 總開關檢查：如果 RUNWARE_ENABLED=false，此函式不應被調用
 */
async function queryRunwareJobStatus(jobId: string): Promise<{
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
}> {
  // 安全檢查：如果 RUNWARE_ENABLED=false，直接返回假狀態
  if (!RUNWARE_ENABLED) {
    console.log("[runware] queryRunwareJobStatus disabled, returning fake status")
    return { status: "succeeded", progress: 100, resultUrls: [] }
  }

  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured")
  }

    try {
      // ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
      // This is the ONLY place that directly fetches from Runware API - protected by RUNWARE_ENABLED check at function start
      const response = await fetch(`${RUNWARE_API_URL}/jobs/${jobId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RUNWARE_API_KEY}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        // TASK 2: Handle 400 errors specifically to prevent infinite polling
        if (response.status === 400) {
          // Read response body for debugging
          let shortBody = ""
          try {
            const bodyText = await response.text()
            shortBody = bodyText.substring(0, 500)
            console.error("[runware] job status 400", { jobId, status: response.status, body: shortBody })
          } catch (e) {
            console.error("[runware] job status 400", { jobId, status: response.status, error: "Failed to read response body" })
          }
          // Return failed status instead of throwing to stop polling
          return { status: "failed" as const, progress: 100 }
        }
        
        // R3: 如果 job 不存在（404），返回 failed 狀態，不要返回 queued（避免無限輪詢）
        if (response.status === 404) {
          console.error("[runware] R3: job status 404 (not found), returning failed", { jobId })
          return { status: "failed" as const, progress: 100 }
        }
        
        // R3: For other non-OK statuses (500, etc.), return failed status instead of throwing
        let shortBody = ""
        try {
          const bodyText = await response.text()
          shortBody = bodyText.substring(0, 500)
          console.error("[runware] R3: job status error", { jobId, status: response.status, body: shortBody })
        } catch (e) {
          console.error("[runware] R3: job status error", { jobId, status: response.status, error: "Failed to read response body" })
        }
        // R3: 返回 failed 狀態，不要 throw（避免造成 500）
        return { status: "failed" as const, progress: 100 }
      }

    const data = await response.json()
    return {
      status: data.status || "queued",
      progress: data.progress,
      resultUrls: data.resultUrls || data.result_urls,
    }
  } catch (error) {
    console.error("[runware] R3: Error querying Runware job status:", error)
    // R3: 如果查詢失敗，返回 failed 狀態，不要返回 queued（避免無限輪詢）
    return { status: "failed" as const, progress: 100 }
  }
}

/**
 * 創建 Runware Provider 實例
 */
export function createRunwareProvider(): GenerationProvider {
  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured. Runware provider requires RUNWARE_API_KEY environment variable.")
  }
  return new RunwareProvider()
}

export class RunwareProvider implements GenerationProvider {
  name: "runware" = "runware"

  /**
   * Task B1-1: Generate with Identity Flow (internal helper)
   * 
   * Uses PhotoMaker with identity reference to preserve facial features.
   * 
   * @param input - Generation request payload
   * @returns GenerateResult with jobId
   */
  private async generateWithIdentity(input: GenerateRequestPayload): Promise<GenerateResult> {
    // 總開關檢查：如果 RUNWARE_ENABLED=false，直接拋出錯誤讓上層 fallback
    if (!RUNWARE_ENABLED) {
      console.log("[runware] identity flow disabled via RUNWARE_ENABLED, fallback to mock")
      const error = new Error("RUNWARE_DISABLED") as any
      error.name = "RunwareDisabledError"
      throw error
    }

    if (!RUNWARE_API_KEY) {
      throw new Error("RUNWARE_API_KEY is not configured")
    }

    // Resolve template config
    const templateConfig = resolveRunwareTemplate(input.template, input.style)
    if (!templateConfig) {
      throw new Error(
        `Runware template not configured for template=${input.template}, style=${input.style}. Only "christmas" + "realistic" is supported.`
      )
    }

    // Validate modelId
    if (!templateConfig.modelId || 
        templateConfig.modelId.trim() === "" || 
        templateConfig.modelId === "RUNWARE_MODEL_CHRISTMAS_REALISTIC_V1") {
      throw new Error(
        `Runware template config has no valid modelId for ${input.template}+${input.style}. ` +
        `Please set RUNWARE_MODEL_ID env var or update lib/templates/runware-templates.ts with actual Runware model ID.`
      )
    }

    // Task B1-1: Identity Flow
    // Step 1: Upload source image to get referenceImageUUID
    // 使用者只上傳一張圖 → 視為 identity + 同時也是 content
    if (!input.files || input.files.length === 0) {
      throw new Error("Identity flow requires at least one source image")
    }

    // T3 Hotfix: 確保完整 URL 被保留
    const sourceImageUrl = input.files[0] // Use first image as identity reference

    // T3 Hotfix: 在 identity flow 調用前，增加清楚的 debug log
    const fullImageUrl = sourceImageUrl
    const shortImageUrl = fullImageUrl.length > 100 
      ? fullImageUrl.substring(0, 100) + "..." 
      : fullImageUrl
    const isSupabaseUrl = fullImageUrl.startsWith("https://") && 
      (fullImageUrl.includes("supabase.co/storage/v1/object/public/") || 
       fullImageUrl.includes("mxdexoahfmwbqwngzzsf.supabase.co"))

    console.log("[runware-provider] B1-1: Starting identity flow", {
      sourceImageUrl: shortImageUrl,
      sourceImageUrlLength: fullImageUrl.length,
      sourceImageUrlStartsWith: fullImageUrl.substring(0, 60),
      isSupabaseUrl,
      template: input.template,
      style: input.style,
    })

    try {
      // Task C3: Step 1: Upload image to get imageUUID
      // T3 Hotfix: 確保傳入的是完整 URL，不是截斷版本
      const { imageUUID, taskUUID: uploadTaskUUID } = await runRunwareImageUpload(fullImageUrl)

      console.log("[runware-provider] C3: Image uploaded, got imageUUID", { 
        imageUUID, 
        uploadTaskUUID,
      })

      // Task C3: Step 2: Generate with imageInference + PuLID using reference image
      const identityTaskUUID = generateTaskUUID()

      const identityResult = await runRunwarePhotoMakerWithReference({
        taskUUID: identityTaskUUID,
        positivePrompt: templateConfig.basePrompt,
        negativePrompt: templateConfig.negativePrompt,
        width: templateConfig.width,
        height: templateConfig.height,
        steps: input.steps || 24,
        model: templateConfig.modelId || "runware:101@1",
        imageUUID,
      })

      console.log("[runware-provider] C3: Identity imageInference (PuLID) generation complete", {
        taskUUID: identityResult.taskUUID,
        imageURL: identityResult.imageURL ? identityResult.imageURL.substring(0, 100) + "..." : null,
        resultUrlsCount: identityResult.resultUrls.length,
      })

      // Task C3: Step 3: Generate jobId with rw_ prefix
      const taskUUID = identityResult.taskUUID
      const jobId = `rw_${taskUUID}`

      // Task C3: Step 4: Store job and images to DB (reuse R2 logic)
      const serviceClient = getServiceClient()
      const userId = (input as any).userId || null

      const imageUrls = identityResult.resultUrls || (identityResult.imageURL ? [identityResult.imageURL] : [])
      const isCompleted = imageUrls.length > 0

      try {
        // 4) Store taskUUID correctly during Runware generation
        // Store job with identityMode flag (Task B1-3)
        // Store identityMode in a metadata field or as a separate column if available
        // For now, we'll store it in a way that can be retrieved later
        await serviceClient.from("jobs").insert({
          job_id: jobId,
          task_uuid: taskUUID, // 4) Store taskUUID for direct Runware API queries
          user_id: userId,
          status: isCompleted ? "completed" : "queued",
          provider: "runware",
          progress: isCompleted ? 100 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Task B1-3: Store identityMode flag (if jobs table has a metadata/jsonb column, use that)
          // For now, we'll pass it through the return value and let /api/results handle it
        })

        // Store images if completed
        if (isCompleted && imageUrls.length > 0) {
          const imageRecords = imageUrls.map((url) => ({
            job_id: jobId,
            image_url: url,
            thumbnail_url: url,
            created_at: new Date().toISOString(),
          }))

          await serviceClient.from("job_images").insert(imageRecords)
          console.log(`[runware-provider] C3: Stored ${imageRecords.length} images to DB for job ${jobId}`)
        }
      } catch (dbError: any) {
        console.error("[runware-provider] C3: Error storing job/images to database:", {
          error: dbError.message,
          code: dbError.code,
        })
        // Continue even if DB storage fails
      }

      // Task B1-3: Return identityMode flag (will be passed through to /api/results)
      return {
        ok: true,
        jobId,
        identityMode: true, // Mark this as identity flow job
        resultUrls: imageUrls, // Task C3: Include resultUrls for reference
      } as GenerateResult & { identityMode?: boolean; resultUrls?: string[] }
    } catch (error: any) {
      console.error("[runware-provider] C3: Identity flow failed", {
        error: error.message,
        errorName: error.name,
        status: error.status,
      })
      throw error
    }
  }

  async generate(input: GenerateRequestPayload, options?: { useIdentityFlow?: boolean }): Promise<GenerateResult> {
    // Task C3: Check if identity flow is requested
    if (options?.useIdentityFlow) {
      try {
        return await this.generateWithIdentity(input)
      } catch (error: any) {
        // Task C3: Fallback to normal imageInference if identity flow fails
        console.warn("[runware-provider] C3: identity flow failed, falling back to normal imageInference", {
          error: error.message,
          errorName: error.name,
          status: error.status,
        })
        // Continue to normal flow below
      }
    }

    // 總開關檢查：如果 RUNWARE_ENABLED=false，直接拋出錯誤讓上層 fallback 到 mock
    if (!RUNWARE_ENABLED) {
      console.log("[runware] disabled via RUNWARE_ENABLED, fallback to mock")
      const error = new Error("RUNWARE_DISABLED") as any
      error.name = "RunwareDisabledError"
      throw error
    }

    // RUNWARE-NOTE: Resolve template config for (template, style) combination
    const templateConfig = resolveRunwareTemplate(input.template, input.style)
    
    if (!templateConfig) {
      // This should be caught by /api/generate and fallback to mock
      throw new Error(
        `Runware template not configured for template=${input.template}, style=${input.style}. Only "christmas" + "realistic" is supported.`
      )
    }

    // Validate modelId before making API call
    if (!templateConfig.modelId || 
        templateConfig.modelId.trim() === "" || 
        templateConfig.modelId === "RUNWARE_MODEL_CHRISTMAS_REALISTIC_V1") {
      const error = new Error(
        `Runware template config has no valid modelId for ${input.template}+${input.style}. ` +
        `Current modelId: "${templateConfig.modelId}". ` +
        `Please set RUNWARE_MODEL_ID env var or update lib/templates/runware-templates.ts with actual Runware model ID.`
      ) as any
      error.name = "RunwareConfigError"
      error.code = "INVALID_MODEL_ID"
      throw error
    }

    // RUNWARE-NOTE: In demo mode, return placeholder jobId without calling Runware API
    // BUT: If NEXT_PUBLIC_FORCE_REAL_GENERATE=true, always call real API even in demo mode
    if (isDemoMode && !isForceRealGenerate) {
      // demo 下先不要真的打 Runware，避免產生成本
      // 除非明確設定 NEXT_PUBLIC_FORCE_REAL_GENERATE=true
      return {
        ok: true,
        jobId: `runware-demo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }
    }

    if (!RUNWARE_API_KEY) {
      // This should be caught by /api/generate and fallback to mock
      throw new Error("RUNWARE_API_KEY is not configured")
    }

    try {
      // Build Runware API payload using templateConfig + input
      // Use template config's basePrompt and modelId
      // 預設使用 sync 模式（deliveryMethod="sync"），直接返回結果，避免 polling
      const runwareRequest: RunwareGenerateRequest = {
        files: input.files,
        style: input.style,
        template: input.template,
        resolution: input.resolution || templateConfig.width, // Use template config width/height as default
        steps: input.steps,
        grayscale_ratio: input.grayscale_ratio,
        // Use template config prompt and model
        prompt: templateConfig.basePrompt,
        model: templateConfig.modelId,
        negativePrompt: templateConfig.negativePrompt,
        width: templateConfig.width,
        height: templateConfig.height,
        // 預設使用 sync 模式，直接返回結果
        deliveryMethod: "sync" as any,
      }

      // ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
      // This is the ONLY place that calls callRunwareAPI() - protected by RUNWARE_ENABLED check at function start
      const runwareResponse = await callRunwareAPI(runwareRequest, {
        timeout: 8000,
        maxRetries: 2,
      })

      // R2: Generate a non-job_ prefix jobId for Runware jobs
      // Use taskUUID from Runware response, or generate rw_ prefix jobId
      const taskUUID = runwareResponse.taskUUID || runwareResponse.jobId
      if (!taskUUID) {
        throw new Error("Runware API returned empty taskUUID/jobId")
      }

      // R2: Generate job_id with rw_ prefix (non-job_ prefix to distinguish from mock jobs)
      const jobId = `rw_${taskUUID}`

      // R1: Log success with imageURL / taskUUID (before DB operations)
      console.log("[runware-provider] generate() success", {
        jobId,
        taskUUID,
        imageURL: runwareResponse.imageURL,
        status: runwareResponse.status,
        resultUrls: runwareResponse.resultUrls,
        hasImageURL: Boolean(runwareResponse.imageURL),
        resultUrlsCount: runwareResponse.resultUrls?.length || 0,
      })

      // R2: 將 job 存儲到 Supabase jobs 表
      // 如果 deliveryMethod="sync" 且返回了 imageURL，直接標記為 completed
      const serviceClient = getServiceClient()
      const userId = (input as any).userId || null // Use null for system jobs
      
      // 檢查是否為 sync 模式且已返回結果
      const isSyncMode = (runwareRequest as any).deliveryMethod === "sync"
      const hasImageURL = runwareResponse.imageURL || (runwareResponse.resultUrls && runwareResponse.resultUrls.length > 0)
      const isCompleted = isSyncMode && hasImageURL && runwareResponse.status === "succeeded"
      
      try {
        // 4) Store taskUUID correctly during Runware generation
        // R2: 建立 job 記錄（使用新的 schema: job_id, task_uuid, status, provider, progress）
        await serviceClient.from("jobs").insert({
          job_id: jobId, // 對外顯示用的 jobId（rw_xxx）
          task_uuid: taskUUID, // 4) Store taskUUID for direct Runware API queries
          user_id: userId,
          status: isCompleted ? "completed" : "queued",
          provider: "runware",
          progress: isCompleted ? 100 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        console.log(`[runware-provider] R2: Stored job to DB`, {
          jobId,
          status: isCompleted ? "completed" : "queued",
          progress: isCompleted ? 100 : 0,
        })
        
        // R2: 如果是 sync 模式且已返回結果，直接存儲圖片到 job_images 表
        if (isCompleted) {
          const imageUrls = runwareResponse.resultUrls || (runwareResponse.imageURL ? [runwareResponse.imageURL] : [])
          
          if (imageUrls.length > 0) {
            const imageRecords = imageUrls.map((url) => ({
              job_id: jobId, // 使用 rw_xxx 格式的 jobId
              image_url: url,
              thumbnail_url: url, // Runware 可能沒有縮略圖，使用原圖
              created_at: new Date().toISOString(),
            }))
            
            try {
              await serviceClient
                .from("job_images")
                .insert(imageRecords)
              
              console.log(`[runware-provider] R2: Stored ${imageRecords.length} images to DB for job ${jobId}`)
            } catch (imageError) {
              console.error("[runware-provider] R2: Error storing images:", imageError)
              // 即使圖片存儲失敗，也繼續返回 jobId（因為 job 已創建）
            }
          }
        }
      } catch (dbError: any) {
        console.error("[runware-provider] R2: Error storing job to database:", {
          error: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint,
        })
        // 即使資料庫存儲失敗，也返回 jobId（因為 Runware 已經創建了 job）
        // 但記錄錯誤以便後續排查
      }

      // R2: Return jobId (rw_xxx format) to /api/generate
      return { ok: true, jobId }
    } catch (error: any) {
      // 如果 Runware API 返回 400 或 timeout，嘗試在 DB 中標記 job 為 failed
      // 注意：此時可能還沒有 jobId（如果 API 調用失敗），所以只能記錄錯誤
      const is400Error = error.status === 400
      const isTimeoutError = error.code === "TIMEOUT" || error.name === "AbortError"
      
      // 嘗試從錯誤中獲取 jobId（如果有的話）
      const errorJobId = error.taskUUID || (error.responseBody?.taskUUID) || null
      
      if ((is400Error || isTimeoutError) && errorJobId) {
        try {
          const serviceClient = getServiceClient()
          const userId = (input as any).userId || "system"
          
          // 嘗試更新或建立 failed job 記錄
          await serviceClient.from("jobs").upsert({
            id: errorJobId,
            user_id: userId,
            style: input.style,
            template: input.template,
            status: "failed",
            progress: 100,
            error_message: error.message || "Runware API error",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "id",
          })
          
          console.log(`[runware] Marked job ${errorJobId} as failed due to ${is400Error ? "400 error" : "timeout"}`)
        } catch (dbError) {
          console.error("[runware] Error marking job as failed:", dbError)
          // 即使 DB 更新失敗，也繼續拋出錯誤
        }
      }
      
      // Custom error for Runware API failures
      // 保留所有錯誤資訊，讓上層可以完整記錄
      const runwareError = new Error(
        `Runware API error: ${error.message || "Unknown error"}`
      ) as any
      runwareError.name = "RunwareGenerateError"
      runwareError.status = error.status || 500
      runwareError.statusText = error.statusText
      runwareError.code = error.code
      runwareError.responseBody = error.responseBody
      runwareError.responseBodyText = error.responseBodyText
      runwareError.xRequestId = error.xRequestId
      runwareError.originalError = error
      runwareError.stack = error.stack
      throw runwareError
    }
  }

  async getProgress(jobId: string): Promise<ProgressResult> {
    // 總開關檢查：如果 RUNWARE_ENABLED=false，直接返回假狀態，不再查詢 Runware API
    if (!RUNWARE_ENABLED) {
      console.log("[runware] getProgress disabled, returning fake completed status")
      return {
        ok: true,
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete! (Runware disabled)",
      }
    }

    const serviceClient = getServiceClient()

    // R3: 從 jobId 中提取 taskUUID（jobId 格式為 rw_${taskUUID}）
    // 如果 jobId 不是 rw_ 開頭，直接使用 jobId
    const taskUUID = jobId.startsWith("rw_") ? jobId.substring(3) : jobId

    // R3: 查詢 Supabase jobs 表獲取狀態（使用 job_id 字段）
    const { data: job, error } = await serviceClient
      .from("jobs")
      .select("job_id, status, progress, error_message, user_id")
      .eq("job_id", jobId)
      .single()

    if (error || !job) {
      // 如果資料庫中沒有，且 RUNWARE_ENABLED=true，嘗試查詢 Runware API
      // 注意：這裡已經在函式開頭檢查過 RUNWARE_ENABLED，所以這裡不會執行到
      // 但為了安全，還是加上檢查
      if (!RUNWARE_ENABLED) {
        return {
          ok: true,
          jobId,
          status: "succeeded",
          progress: 100,
          message: "Generation complete! (Runware disabled)",
        }
      }
      
      // R3: ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
      // Protected by RUNWARE_ENABLED check in queryRunwareJobStatus() function
      // 使用 taskUUID 查詢 Runware API（不是 rw_ 前綴的 jobId）
      const runwareStatus = await queryRunwareJobStatus(taskUUID)
      
      // R3: Handle failed status - update DB and return failed status without retrying
      if (runwareStatus.status === "failed") {
        // Update database to mark job as failed (使用 job_id)
        try {
          await serviceClient.from("jobs")
            .update({
              status: "failed",
              progress: 100,
              updated_at: new Date().toISOString(),
            })
            .eq("job_id", jobId)
        } catch (dbError) {
          console.error("[runware] R3: Error updating job status to failed:", dbError)
        }
        
        // Return failed status - this will stop polling
        return {
          ok: true,
          jobId,
          status: "failed",
          progress: 100,
          message: "Generation failed",
          errorMessage: "Runware API returned failed status",
        }
      }
      
      // R3: 如果找到 job，更新資料庫（使用 job_id）
      if (runwareStatus.status !== "queued" || runwareStatus.progress !== 0) {
        // 嘗試更新資料庫（如果 job 存在）
        await serviceClient.from("jobs")
          .update({
            status: runwareStatus.status === "succeeded" ? "completed" : 
                    runwareStatus.status === "failed" ? "failed" :
                    runwareStatus.status === "running" ? "processing" : "queued",
            progress: runwareStatus.progress || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId)
      }

      // 轉換狀態：queued/running/succeeded/failed → pending/processing/succeeded/failed
      const statusMap: Record<string, "pending" | "processing" | "succeeded" | "failed"> = {
        queued: "pending",
        running: "processing",
        succeeded: "succeeded",
        failed: "failed",
      }
      
      return {
        ok: true,
        jobId,
        status: statusMap[runwareStatus.status] || "pending",
        progress: runwareStatus.progress || 0,
        message: runwareStatus.status === "succeeded" 
          ? "Generation complete!" 
          : runwareStatus.status === "failed"
          ? "Generation failed"
          : "Processing your images...",
      }
    }

    // 2. 正規化資料庫狀態為 ProgressResult 狀態
    const statusMap: Record<string, "pending" | "processing" | "succeeded" | "failed"> = {
      pending: "pending",
      processing: "processing",
      completed: "succeeded",
      failed: "failed",
    }

    const progressStatus = statusMap[job.status] || "pending"
    const progress = job.progress || (progressStatus === "succeeded" ? 100 : 0)

    // 3. 如果狀態已經是 succeeded，直接返回，不再查詢 Runware API（避免重複扣點）
    if (progressStatus === "succeeded") {
      return {
        ok: true,
        jobId,
        status: progressStatus,
        progress,
        message: "Generation complete!",
      }
    }

    // 4. 如果狀態不是終態，且 RUNWARE_ENABLED=true，可選：查詢 Runware API 更新狀態
    // ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
    if (progressStatus !== "failed" && RUNWARE_ENABLED) {
      // 非阻塞：在背景更新狀態（不等待完成）
      // Protected by RUNWARE_ENABLED check in queryRunwareJobStatus() function
      queryRunwareJobStatus(jobId)
        .then(async (runwareStatus) => {
          try {
            // 更新資料庫狀態
            await serviceClient
              .from("jobs")
              .update({
                status: runwareStatus.status === "succeeded" ? "completed" : 
                        runwareStatus.status === "failed" ? "failed" :
                        runwareStatus.status === "running" ? "processing" : "pending",
                progress: runwareStatus.progress || progress,
                updated_at: new Date().toISOString(),
              })
              .eq("id", jobId)

            // 如果狀態為 succeeded，存儲圖片 URL
            if (runwareStatus.status === "succeeded" && runwareStatus.resultUrls) {
              // 存儲圖片到 job_images 表
              const images = runwareStatus.resultUrls.map((url, idx) => ({
                job_id: jobId,
                url,
                thumbnail_url: url, // Runware 可能沒有縮略圖，使用原圖
                created_at: new Date().toISOString(),
              }))

              try {
                await serviceClient
                  .from("job_images")
                  .upsert(images, {
                    onConflict: "job_id,url",
                  })
              } catch (err) {
                console.error("Error storing images:", err)
              }
            }
          } catch (err) {
            console.error("Error updating job status:", err)
          }
        })
        .catch((err) => {
          console.error("Error querying Runware status:", err)
        })
    }

    return {
      ok: true,
      jobId,
      status: progressStatus,
      progress,
      message: progressStatus === "succeeded"
        ? "Generation complete!"
        : progressStatus === "failed"
        ? job.error_message || "Generation failed"
        : "Processing your images...",
      errorMessage: progressStatus === "failed" ? job.error_message : undefined,
    }
  }

  async getResults(jobId: string, options?: { paid?: boolean }): Promise<ResultsResult> {
    // 總開關檢查：如果 RUNWARE_ENABLED=false，只從資料庫查詢，不再查詢 Runware API
    if (!RUNWARE_ENABLED) {
      console.log("[runware] getResults disabled, querying database only")
    }

    const serviceClient = getServiceClient()

    // 1. 查詢 Supabase job_images 表獲取圖片列表
    const { data: images, error: imagesError } = await serviceClient
      .from("job_images")
      .select("id, url, thumbnail_url")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    if (imagesError) {
      console.error("Error fetching images:", imagesError)
    }

    // 2. 如果圖片尚未存儲，且 RUNWARE_ENABLED=true，查詢 Runware API 獲取並存儲
    if (!images || images.length === 0) {
      if (!RUNWARE_ENABLED) {
        // 如果 Runware 被禁用，返回空陣列
        return {
          ok: true,
          jobId,
          images: [],
          paymentStatus: options?.paid ? "paid" : "free",
        }
      }
      
      // ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
      // Protected by RUNWARE_ENABLED check in queryRunwareJobStatus() function
      const runwareStatus = await queryRunwareJobStatus(jobId)
      
      if (runwareStatus.status === "succeeded" && runwareStatus.resultUrls && runwareStatus.resultUrls.length > 0) {
        // 存儲圖片到 job_images 表
        const imageRecords = runwareStatus.resultUrls.map((url, idx) => ({
          job_id: jobId,
          url,
          thumbnail_url: url, // Runware 可能沒有縮略圖，使用原圖
          created_at: new Date().toISOString(),
        }))

        const { data: insertedImages, error: insertError } = await serviceClient
          .from("job_images")
          .insert(imageRecords)
          .select("id, url, thumbnail_url")

        if (insertError) {
          console.error("Error storing images:", insertError)
          // 即使存儲失敗，也返回圖片 URL
          return {
            ok: true,
            jobId,
            images: runwareStatus.resultUrls,
            paymentStatus: options?.paid ? "paid" : "free",
          }
        }

        return {
          ok: true,
          jobId,
          images: (insertedImages || []).map((img) => img.url),
          paymentStatus: options?.paid ? "paid" : "free",
        }
      }

      // 如果狀態不是 succeeded，返回空陣列
      return {
        ok: true,
        jobId,
        images: [],
        paymentStatus: options?.paid ? "paid" : "free",
      }
    }

    // 3. 返回 ResultsResult 格式
    return {
      ok: true,
      jobId,
      images: images.map((img) => img.url),
      paymentStatus: options?.paid ? "paid" : "free",
    }
  }
}


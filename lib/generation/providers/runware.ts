/**
 * Runware Provider
 * 
 * 實作 Runware API 的 GenerationProvider
 * RUNWARE-NOTE: Uses template config to map (template, style) -> Runware model + prompts
 */

import { GenerationProvider, GenerateRequestPayload, GenerateResult, ProgressResult, ResultsResult } from "./base"
import { callRunwareAPI, RunwareGenerateRequest } from "../runware-client"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveRunwareTemplate } from "@/lib/templates/runware-templates"
import { isDemoMode, isForceRealGenerate } from "@/lib/featureFlags"

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
        
        // 如果 job 不存在或 API 錯誤，返回預設狀態
        if (response.status === 404) {
          return { status: "queued", progress: 0 }
        }
        
        // TASK 2: For other non-OK statuses, log response body before throwing
        let shortBody = ""
        try {
          const bodyText = await response.text()
          shortBody = bodyText.substring(0, 500)
          console.error("[runware] job status error", { jobId, status: response.status, body: shortBody })
        } catch (e) {
          console.error("[runware] job status error", { jobId, status: response.status, error: "Failed to read response body" })
        }
        throw new Error(`Runware API error: ${response.status}`)
      }

    const data = await response.json()
    return {
      status: data.status || "queued",
      progress: data.progress,
      resultUrls: data.resultUrls || data.result_urls,
    }
  } catch (error) {
    console.error("Error querying Runware job status:", error)
    // 如果查詢失敗，返回預設狀態（不拋出錯誤，讓資料庫狀態作為 fallback）
    return { status: "queued", progress: 0 }
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

  async generate(input: GenerateRequestPayload): Promise<GenerateResult> {
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

      // Runware HTTP API returns taskUUID (mapped to jobId for backward compatibility)
      const jobId = runwareResponse.jobId || runwareResponse.taskUUID

      if (!jobId) {
        throw new Error("Runware API returned empty jobId/taskUUID")
      }

      // 2. 將 job 存儲到 Supabase jobs 表
      // 如果 deliveryMethod="sync" 且返回了 imageURL，直接標記為 succeeded
      const serviceClient = getServiceClient()
      const userId = (input as any).userId || "system"
      
      // 檢查是否為 sync 模式且已返回結果
      const isSyncMode = (runwareRequest as any).deliveryMethod === "sync"
      const hasImageURL = runwareResponse.imageURL || (runwareResponse.resultUrls && runwareResponse.resultUrls.length > 0)
      const isCompleted = isSyncMode && hasImageURL && runwareResponse.status === "succeeded"
      
      try {
        // 建立 job 記錄
        await serviceClient.from("jobs").insert({
          id: jobId,
          user_id: userId,
          style: input.style,
          template: input.template,
          status: isCompleted ? "completed" : "pending",
          progress: isCompleted ? 100 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        // 如果是 sync 模式且已返回結果，直接存儲圖片到 job_images 表
        if (isCompleted) {
          const imageUrls = runwareResponse.resultUrls || (runwareResponse.imageURL ? [runwareResponse.imageURL] : [])
          
          if (imageUrls.length > 0) {
            const imageRecords = imageUrls.map((url) => ({
              job_id: jobId,
              url,
              thumbnail_url: url, // Runware 可能沒有縮略圖，使用原圖
              created_at: new Date().toISOString(),
            }))
            
            try {
              await serviceClient
                .from("job_images")
                .insert(imageRecords)
              
              console.log(`[runware] Sync mode: stored ${imageRecords.length} images for job ${jobId}`)
            } catch (imageError) {
              console.error("[runware] Error storing images in sync mode:", imageError)
              // 即使圖片存儲失敗，也繼續返回 jobId（因為 job 已創建）
            }
          }
        }
      } catch (dbError) {
        console.error("Error storing job to database:", dbError)
        // 即使資料庫存儲失敗，也返回 jobId（因為 Runware 已經創建了 job）
      }

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

    // 1. 查詢 Supabase jobs 表獲取狀態
    const { data: job, error } = await serviceClient
      .from("jobs")
      .select("status, progress, error_message, user_id")
      .eq("id", jobId)
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
      
      // ⚠️ Only call Runware API when RUNWARE_ENABLED === true (prod only, may consume credits)
      // Protected by RUNWARE_ENABLED check in queryRunwareJobStatus() function
      const runwareStatus = await queryRunwareJobStatus(jobId)
      
      // TASK 2: Handle failed status - update DB and return failed status without retrying
      if (runwareStatus.status === "failed") {
        // Update database to mark job as failed
        try {
          await serviceClient.from("jobs").upsert({
            id: jobId,
            status: "failed",
            progress: 100,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "id",
          })
        } catch (dbError) {
          console.error("[runware] Error updating job status to failed:", dbError)
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
      
      // 如果找到 job，更新資料庫
      if (runwareStatus.status !== "queued" || runwareStatus.progress !== 0) {
        // 嘗試更新資料庫（如果 job 存在）
        await serviceClient.from("jobs").upsert({
          id: jobId,
          status: runwareStatus.status === "succeeded" ? "completed" : 
                  runwareStatus.status === "failed" ? "failed" :
                  runwareStatus.status === "running" ? "processing" : "pending",
          progress: runwareStatus.progress || 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "id",
        })
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


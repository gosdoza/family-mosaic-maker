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
import { isDemoMode } from "@/lib/featureFlags"

const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY
const RUNWARE_BASE_URL = process.env.RUNWARE_BASE_URL || "https://api.runware.ai"
const RUNWARE_API_URL = process.env.RUNWARE_API_URL || `${RUNWARE_BASE_URL}/v1`

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
 */
async function queryRunwareJobStatus(jobId: string): Promise<{
  status: "queued" | "running" | "succeeded" | "failed"
  progress?: number
  resultUrls?: string[]
}> {
  if (!RUNWARE_API_KEY) {
    throw new Error("RUNWARE_API_KEY is not configured")
  }

  try {
    const response = await fetch(`${RUNWARE_API_URL}/jobs/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      // 如果 job 不存在或 API 錯誤，返回預設狀態
      if (response.status === 404) {
        return { status: "queued", progress: 0 }
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
    // RUNWARE-NOTE: Resolve template config for (template, style) combination
    const templateConfig = resolveRunwareTemplate(input.template, input.style)
    
    if (!templateConfig) {
      // RUNWARE-TODO: 之後可以 fallback 到 mock 或丟出更清楚的錯誤
      throw new Error(
        `Runware template not configured for template=${input.template}, style=${input.style}. Only "christmas" + "realistic" is supported.`
      )
    }

    // RUNWARE-NOTE: In demo mode, return placeholder jobId without calling Runware API
    if (isDemoMode) {
      // demo 下先不要真的打 Runware，避免產生成本
      return {
        ok: true,
        jobId: `runware-demo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }
    }

    if (!RUNWARE_API_KEY) {
      throw new Error("RUNWARE_API_KEY is not configured")
    }

    // RUNWARE-TODO: build Runware API payload using templateConfig + input
    // 目前先使用現有的 callRunwareAPI，之後可以根據 templateConfig 調整 prompt
    const runwareRequest: RunwareGenerateRequest = {
      files: input.files,
      style: input.style,
      template: input.template,
      resolution: input.resolution,
      steps: input.steps,
      grayscale_ratio: input.grayscale_ratio,
      // RUNWARE-TODO: Use templateConfig.basePrompt and templateConfig.modelId
      // prompt: templateConfig.basePrompt,
      // model: templateConfig.modelId,
    }

    // RUNWARE-TODO: call real Runware API here
    const runwareResponse = await callRunwareAPI(runwareRequest, {
      timeout: 8000,
      maxRetries: 2,
    })

    const jobId = runwareResponse.jobId

    // 2. 將 job 存儲到 Supabase jobs 表（如果可能）
    // 注意：如果沒有 userId，我們仍然返回 jobId（因為 Runware 已經創建了 job）
    try {
      const serviceClient = getServiceClient()
      // 嘗試從 input 中獲取 userId（如果有的話）
      const userId = (input as any).userId || "system"
      
      await serviceClient.from("jobs").insert({
        id: jobId,
        user_id: userId,
        style: input.style,
        template: input.template,
        status: "pending",
        progress: 0,
        created_at: new Date().toISOString(),
      })
    } catch (dbError) {
      console.error("Error storing job to database:", dbError)
      // 即使資料庫存儲失敗，也返回 jobId（因為 Runware 已經創建了 job）
    }

    return { ok: true, jobId }
  }

  async getProgress(jobId: string): Promise<ProgressResult> {
    const serviceClient = getServiceClient()

    // 1. 查詢 Supabase jobs 表獲取狀態
    const { data: job, error } = await serviceClient
      .from("jobs")
      .select("status, progress, error_message, user_id")
      .eq("id", jobId)
      .single()

    if (error || !job) {
      // 如果資料庫中沒有，嘗試查詢 Runware API
      const runwareStatus = await queryRunwareJobStatus(jobId)
      
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

    // 3. 如果狀態不是終態，可選：查詢 Runware API 更新狀態
    if (progressStatus !== "succeeded" && progressStatus !== "failed") {
      // 非阻塞：在背景更新狀態（不等待完成）
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

    // 2. 如果圖片尚未存儲，查詢 Runware API 獲取並存儲
    if (!images || images.length === 0) {
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


import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { updateMockJobState, createMockJob } from "@/lib/generation/mock-state-machine"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"
import { isDemoJob } from "@/lib/featureFlags"

// 總開關：當 RUNWARE_ENABLED=false 時，完全禁用 Runware API 調用
const RUNWARE_ENABLED =
  process.env.RUNWARE_ENABLED !== "false" &&
  process.env.RUNWARE_ENABLED !== "0"

// Mock Job 状态存储（内存，生产环境应使用数据库）
const mockJobStore = new Map<string, ReturnType<typeof createMockJob>>()

/**
 * Progress API Route
 * 
 * Mock Job 規則：
 * - jobId 以 "job_" 開頭 → Mock job，直接返回成功狀態，不調用 Runware API，不查詢 Supabase
 * - 其他 jobId → 可能是 Runware job，走正常的 provider 流程
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const jobId = resolvedParams.id

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Mock Job 判斷：jobId 以 "job_" 開頭 → 直接返回成功，不調用 Runware，不查詢 DB
    if (jobId.startsWith("job_")) {
      console.log("[api/progress] Mock job detected (job_ prefix), returning success without Runware/DB calls", { jobId })
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
        provider: "mock",
        isMock: true,
      })
    }

    // Task A2: Runware job 的 progress 行為（/api/progress）要「秒完成」
    // 如果 jobId 以 rw_ 開頭，且 Runware 的 generate() 本身是 sync（一次就拿到 imageURL），直接返回成功狀態
    if (jobId.startsWith("rw_")) {
      console.log(`[api/progress] Task A2: Runware job detected (rw_ prefix), returning success immediately for job ${jobId}`)
      // Task A2 Option A（最簡）：對 rw_... 直接回成功狀態，不再打 Runware status API
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
        provider: "runware",
        isMock: false,
      })
    }

    // Route A: demo-001 固定返回成功（全 mock demo flow）
    // NOTE: behavior preserved, just using centralized feature flags
    if (isDemoJob(jobId)) {
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Mock job completed",
      })
    }

    // 测试模式：非 production 且 ALLOW_TEST_LOGIN=true 时，对测试 jobId 直接返回完成状态
    const isTestMode = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_LOGIN === 'true'
    if (isTestMode && (jobId === 'test-job-001' || jobId.startsWith('test-job-'))) {
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
      })
    }

    // 總開關檢查：如果 RUNWARE_ENABLED=false，直接返回假狀態，不再查詢 Runware API
    if (!RUNWARE_ENABLED) {
      console.log("[api/progress] RUNWARE_DISABLED, returning fake status for job", jobId)
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete! (Runware disabled)",
      })
    }

    // R3: Runware 分支：先查 DB，再查 Runware（避免重複扣點）
    // 對於非 job_ 開頭的 jobId，先從 DB 查詢狀態
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    // R3: 先檢查 DB 中是否有這個 job
    const { data: dbJob, error: dbJobError } = await serviceClient
      .from("jobs")
      .select("job_id, status, progress, provider")
      .eq("job_id", jobId)
      .single()
    
    // R3: 如果 DB 中有 job 記錄
    if (dbJob && !dbJobError) {
      // R3: 如果 status 是 completed / failed → 直接返回，不查 Runware
      if (dbJob.status === "completed" || dbJob.status === "failed") {
        console.log(`[api/progress] R3: Job ${jobId} is ${dbJob.status} in DB, returning without Runware API call`)
        
        const statusMap: Record<string, string> = {
          completed: "succeeded",
          failed: "failed",
          queued: "processing",
          processing: "processing",
        }
        
        return NextResponse.json({
          jobId,
          status: statusMap[dbJob.status] || dbJob.status,
          progress: dbJob.progress || (dbJob.status === "completed" ? 100 : dbJob.status === "failed" ? 100 : 0),
          message: dbJob.status === "completed" ? "Generation complete!" : dbJob.status === "failed" ? "Generation failed" : undefined,
        })
      }
      
      // R3: 如果 status 是 queued / processing → 才呼叫 RunwareProvider.getProgress()
      if (dbJob.status === "queued" || dbJob.status === "processing") {
        if (!RUNWARE_ENABLED) {
          // Runware 未啟用，直接返回 DB 狀態
          return NextResponse.json({
            jobId,
            status: "processing",
            progress: dbJob.progress || 0,
            message: "Generation in progress...",
          })
        }
        
        // R3: 使用 RunwareProvider 查詢進度
        try {
          const { createRunwareProvider } = await import("@/lib/generation/providers/runware")
          const runwareProvider = createRunwareProvider()
          
          const progress = await runwareProvider.getProgress(jobId)
          
          // R3: getProgress() 回來後，更新 DB 裡的 status / progress
          try {
            const updateData: any = {
              updated_at: new Date().toISOString(),
            }
            
            // 映射 ProgressResult 狀態到 DB 狀態
            if (progress.status === "succeeded") {
              updateData.status = "completed"
              updateData.progress = 100
            } else if (progress.status === "failed") {
              updateData.status = "failed"
              updateData.progress = 100
            } else if (progress.status === "processing" || progress.status === "pending") {
              updateData.status = "processing"
              updateData.progress = progress.progress || dbJob.progress || 0
            }
            
            await serviceClient
              .from("jobs")
              .update(updateData)
              .eq("job_id", jobId)
            
            console.log(`[api/progress] R3: Updated DB status for job ${jobId}`, updateData)
          } catch (updateError) {
            console.error(`[api/progress] R3: Failed to update DB for job ${jobId}:`, updateError)
            // 即使更新失敗，也繼續返回 progress 結果
          }
          
          // R3: 再把結果回給前端
          const statusMap: Record<string, string> = {
            pending: "processing",
            processing: "processing",
            succeeded: "succeeded",
            failed: "failed",
          }
          
          const apiStatus = statusMap[progress.status] || progress.status
          
          // 記錄 progress_tick 事件
          await logAnalyticsEvent({
            event_type: "progress_tick",
            job_id: jobId,
            data: {
              status: progress.status,
              progress: progress.progress,
              provider: "runware",
            },
          })
          
          return NextResponse.json({
            jobId,
            status: apiStatus,
            progress: progress.progress,
            message: progress.message || progress.errorMessage,
          })
        } catch (error: any) {
          console.error(`[api/progress] R3: Error in RunwareProvider.getProgress:`, error)
          
          // R3: 如果 Runware API 錯誤，更新 DB 為 failed
          try {
            await serviceClient
              .from("jobs")
              .update({
                status: "failed",
                progress: 100,
                updated_at: new Date().toISOString(),
              })
              .eq("job_id", jobId)
          } catch (updateError) {
            console.error(`[api/progress] R3: Failed to update DB to failed for job ${jobId}:`, updateError)
          }
          
          // 返回 failed 狀態，停止 polling
          return NextResponse.json({
            jobId,
            status: "failed",
            progress: 100,
            message: "Generation failed",
          })
        }
      }
    }
    
    // R3: 如果 DB 中沒有 job 記錄，使用 MockProvider（fallback）
    // 這可能是舊的 mock job 或測試 job
    const { createMockProvider } = await import("@/lib/generation/providers/mock")
    const mockProvider = createMockProvider()
    
    try {
      const progress = await mockProvider.getProgress(jobId)
      
      // Mock provider 永遠不應該返回 failed 狀態
      if (progress.status === "failed") {
        console.warn(`[progress] Mock provider returned failed for job ${jobId}, forcing succeeded`)
        return NextResponse.json({
          jobId,
          status: "succeeded",
          progress: 100,
          message: "Generation complete!",
        })
      }
      
      // 記錄 progress_tick 事件
      await logAnalyticsEvent({
        event_type: "progress_tick",
        job_id: jobId,
        data: {
          status: progress.status,
          progress: progress.progress,
          provider: "mock",
        },
      })
      
      const statusMap: Record<string, string> = {
        pending: "processing",
        processing: "processing",
        succeeded: "succeeded",
        failed: "succeeded", // Mock 永遠成功
      }
      
      const apiStatus = statusMap[progress.status] || "succeeded"
      
      return NextResponse.json({
        jobId,
        status: apiStatus,
        progress: progress.progress,
        message: progress.message || progress.errorMessage,
      })
    } catch (error: any) {
      console.error(`[api/progress] Error in MockProvider.getProgress:`, error)
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
      })
    }

  } catch (error) {
    console.error("Error in progress API:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}

/**
 * 记录 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  job_id: string
  data?: any
}) {
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    await serviceClient.from("analytics_logs").insert({
      event_type: event.event_type,
      event_data: {
        job_id: event.job_id,
        ...event.data,
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log analytics event:", error)
    // 不抛出错误，避免影响主流程
  }
}

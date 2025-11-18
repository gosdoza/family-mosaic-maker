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

    // Route B: Use provider system (Mock or Runware)
    // 修復：判斷 job 是來自 Runware 還是 Mock
    // - 如果 DB 中有 job 記錄且 status 不是 pending/processing，可能是 Runware job
    // - 否則，使用 MockProvider（因為 Mock job 不會在 DB 中）
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
    
    // 先檢查 DB 中是否有這個 job
    const { data: dbJob } = await serviceClient
      .from("jobs")
      .select("id, status")
      .eq("id", jobId)
      .single()
    
    // 判斷使用哪個 provider
    // - 如果 DB 中有 job 記錄，可能是 Runware job（Runware 會寫入 DB）
    // - 如果 DB 中沒有，且不是 demo-001，使用 MockProvider
    let provider = getGenerationProvider()
    const isRunwareJob = dbJob !== null && dbJob !== undefined
    
    if (isRunwareJob && RUNWARE_ENABLED) {
      // DB 中有 job，嘗試使用 RunwareProvider
      try {
        const { createRunwareProvider } = await import("@/lib/generation/providers/runware")
        provider = createRunwareProvider()
      } catch (error) {
        // 如果 RunwareProvider 創建失敗，fallback 到 mock
        console.warn("[progress] Failed to create RunwareProvider, using mock:", error)
      }
    } else {
      // DB 中沒有 job，或 Runware 未啟用，使用 MockProvider
      const { createMockProvider } = await import("@/lib/generation/providers/mock")
      provider = createMockProvider()
    }
    
    try {
      const progress = await provider.getProgress(jobId)
      
      // 修復：Mock provider 永遠不應該返回 failed 狀態
      // 如果 provider 是 mock 且返回 failed，強制改為 succeeded
      if (provider.name === "mock" && progress.status === "failed") {
        console.warn(`[progress] Mock provider returned failed for job ${jobId}, forcing succeeded`)
        return NextResponse.json({
          jobId,
          status: "succeeded",
          progress: 100,
          message: "Generation complete!",
        })
      }
      
      // TASK 2: If status is failed, return it immediately without retrying
      if (progress.status === "failed") {
        const statusMap: Record<string, string> = {
          pending: "processing",
          processing: "processing",
          succeeded: "succeeded",
          failed: "failed",
        }
        
        return NextResponse.json({
          jobId,
          status: statusMap[progress.status] || "failed",
          progress: progress.progress || 100,
          message: progress.message || progress.errorMessage || "Generation failed",
        })
      }
      
      // 記錄 progress_tick 事件
      await logAnalyticsEvent({
        event_type: "progress_tick",
        job_id: jobId,
        data: {
          status: progress.status,
          progress: progress.progress,
          provider: provider.name,
        },
      })

      // 正規化狀態（與現有 API 回應格式一致）
      // ProgressResult 狀態: pending/processing/succeeded/failed
      // API 回應狀態: queued/processing/succeeded/failed (或 pending/processing/succeeded/failed)
      const statusMap: Record<string, string> = {
        pending: "processing", // pending → processing (與現有 API 一致)
        processing: "processing",
        succeeded: "succeeded",
        failed: "failed",
      }
      
      const apiStatus = statusMap[progress.status] || progress.status

      return NextResponse.json({
        jobId,
        status: apiStatus,
        progress: progress.progress,
        message: progress.message || progress.errorMessage,
      })
    } catch (error: any) {
      console.error(`Error in ${provider.name}Provider.getProgress:`, error)
      
      // TASK 2: For Runware errors, return failed status instead of throwing
      if (provider.name === "runware" && !isDemoJob(jobId)) {
        console.warn("[progress] RunwareProvider failed, returning failed status:", error.message)
        // Log error but return failed status to stop polling
        return NextResponse.json({
          jobId,
          status: "failed",
          progress: 100,
          message: "Generation failed",
        })
      }
      
      // 如果是 Mock Provider 且是 demo-001，特殊處理（向後兼容）
      if (provider.name === "mock" && isDemoJob(jobId)) {
        return NextResponse.json({
          jobId,
          status: "succeeded",
          progress: 100,
          message: "Generation complete!",
        })
      }

      // 其他錯誤返回 500
      return NextResponse.json({ 
        error: "Failed to fetch progress",
        message: error.message || "Unknown error",
      }, { status: 500 })
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

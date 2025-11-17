import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { updateMockJobState, createMockJob } from "@/lib/generation/mock-state-machine"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"
import { isDemoJob } from "@/lib/featureFlags"

// Mock Job 状态存储（内存，生产环境应使用数据库）
const mockJobStore = new Map<string, ReturnType<typeof createMockJob>>()

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

    // Route B: Use provider system (Mock or Runware)
    // Check if job is from Runware (non-demo job) and runwareMode is enabled
    const { runwareMode, isPreviewEnv } = await import("@/lib/featureFlags")
    const isRunwareJob = !isDemoJob(jobId) && runwareMode === "real"
    
    // Determine which provider to use
    // - demo-001: always use mock (already handled above)
    // - Runware job: use RunwareProvider if enabled
    // - Others: use MockProvider
    let provider = getGenerationProvider()
    
    // If it's a Runware job but provider is mock, try to get RunwareProvider
    if (isRunwareJob && provider.name === "mock") {
      try {
        const { createRunwareProvider } = await import("@/lib/generation/providers/runware")
        provider = createRunwareProvider()
      } catch (error) {
        // If RunwareProvider creation fails (e.g., missing API key), fallback to mock
        console.warn("[progress] Failed to create RunwareProvider, using mock:", error)
      }
    }
    
    try {
      const progress = await provider.getProgress(jobId)
      
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
      
      // If Runware fails, fallback to mock for non-demo jobs
      if (provider.name === "runware" && !isDemoJob(jobId)) {
        console.warn("[progress] RunwareProvider failed, falling back to mock:", error.message)
        try {
          const { createMockProvider } = await import("@/lib/generation/providers/mock")
          const mockProvider = createMockProvider()
          const fallbackProgress = await mockProvider.getProgress(jobId)
          
          const statusMap: Record<string, string> = {
            pending: "processing",
            processing: "processing",
            succeeded: "succeeded",
            failed: "failed",
          }
          
          return NextResponse.json({
            jobId,
            status: statusMap[fallbackProgress.status] || fallbackProgress.status,
            progress: fallbackProgress.progress,
            message: fallbackProgress.message || "Fallback to mock progress",
          })
        } catch (fallbackError) {
          console.error("[progress] Mock fallback also failed:", fallbackError)
        }
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

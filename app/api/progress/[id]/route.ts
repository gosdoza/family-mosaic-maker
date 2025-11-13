import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { updateMockJobState, createMockJob } from "@/lib/generation/mock-state-machine"

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

    // Check if we're using mock mode
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

    if (useMock) {
      // Mock 模式：使用状态机模拟进度
      let job = mockJobStore.get(jobId)
      
      if (!job) {
        // 创建新的 Mock Job
        job = createMockJob(jobId)
        mockJobStore.set(jobId, job)
      } else {
        // 更新 Mock Job 状态
        job = updateMockJobState(job)
        mockJobStore.set(jobId, job)
      }

      // 记录 progress_tick 事件
      await logAnalyticsEvent({
        event_type: "progress_tick",
        job_id: jobId,
        data: {
          status: job.status,
          progress: job.progress,
        },
      })

      return NextResponse.json({
        jobId,
        status: job.status === "queued" ? "processing" : job.status === "running" ? "processing" : job.status,
        progress: job.progress,
        message: job.message,
      })
    }

    // 测试模式：允许跳过用户验证
    const isTestModeForAuth = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_LOGIN === 'true'
    let user: { id: string } | null = null
    
    if (isTestModeForAuth) {
      user = { id: "test-user" }
    } else {
      // Get current user
      const supabase = await createClient()
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      user = currentUser
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch job status from database
    const { data: job, error } = await supabase
      .from("jobs")
      .select("status, progress, error_message")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Map database status to API response
    const statusMap: Record<string, string> = {
      pending: "processing",
      processing: "processing",
      completed: "succeeded",
      failed: "failed",
    }

    const apiStatus = statusMap[job.status] || "processing"
    const progress = job.progress || (apiStatus === "succeeded" ? 100 : 50)

    // 记录 progress_tick 事件
    await logAnalyticsEvent({
      event_type: "progress_tick",
      job_id: jobId,
      data: {
        status: apiStatus,
        progress,
      },
    })

    return NextResponse.json({
      jobId,
      status: apiStatus,
      progress,
      message:
        apiStatus === "succeeded"
          ? "Generation complete!"
          : apiStatus === "failed"
            ? job.error_message || "Generation failed"
            : "Processing your images...",
    })
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

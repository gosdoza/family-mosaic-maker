import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import e2eStore from "@/lib/e2eStore"
import { generateMockPreviewUrls } from "@/lib/generation/mock-state-machine"
import { calculateQualityScores, shouldIssueVoucher, generateVoucher } from "@/lib/generation/quality-scorer"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"
import { isDemoJob } from "@/lib/featureFlags"

/**
 * Results API Route
 * 
 * 分支邏輯：
 * 1. jobId 以 "job_" 開頭 → Mock job，返回固定 mock 圖片
 * 2. jobId 以 "rw_" 開頭 → Runware job，完全依賴 Supabase DB（不再調用 Runware API）
 * 3. 其他 jobId → 走現有邏輯（向後兼容）
 */

/**
 * Helper: 從 Supabase DB 查詢 Runware job 的圖片
 */
async function fetchRunwareJobImages(jobId: string): Promise<{
  images: Array<{ id: number; url: string; thumbnail: string }>
  paymentStatus: "paid" | "unpaid" | "free"
  createdAt: string
  identityMode?: boolean
}> {
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

  // 查詢 job_images 表
  const { data: jobImages, error: imagesError } = await serviceClient
    .from("job_images")
    .select("id, image_url, thumbnail_url, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })

  if (imagesError) {
    console.error(`[api/results] Error fetching job_images for job ${jobId}:`, {
      error: imagesError.message,
      code: imagesError.code,
      details: imagesError.details,
    })
    throw new Error(`Failed to fetch job images: ${imagesError.message}`)
  }

  if (!jobImages || jobImages.length === 0) {
    console.warn(`[api/results] Runware job ${jobId} has no corresponding job_images records in database`)
    return {
      images: [],
      paymentStatus: "free",
      createdAt: new Date().toISOString(),
      identityMode: false,
    }
  }

  // 格式化圖片陣列（使用正確的欄位名稱：image_url, thumbnail_url）
  const images = jobImages.map((img, idx) => ({
    id: idx + 1,
    url: img.image_url, // 使用 image_url 欄位
    thumbnail: img.thumbnail_url ?? img.image_url, // thumbnail_url 為 null 時 fallback 到 image_url
  }))

  // 查詢 job 的 created_at 和支付狀態
  const { data: jobData, error: jobError } = await serviceClient
    .from("jobs")
    .select("created_at, status")
    .eq("job_id", jobId)
    .single()

  if (jobError) {
    console.warn(`[api/results] Error fetching job data for ${jobId}:`, jobError.message)
  }

  // 查詢支付狀態（從 orders 表）
  let paymentStatus: "paid" | "unpaid" | "free" = "free"
  try {
    const { data: orders } = await serviceClient
      .from("orders")
      .select("payment_status, status")
      .eq("job_id", jobId)
      .limit(1)

    if (orders && orders.length > 0) {
      const order = orders[0]
      paymentStatus = order.payment_status === "paid" || order.status === "paid" ? "paid" : "unpaid"
    }
  } catch (orderError: any) {
    console.warn(`[api/results] Error fetching order status for job ${jobId}:`, orderError.message)
    // 默認為 free
  }

  return {
    images,
    paymentStatus,
    createdAt: jobData?.created_at || jobImages[0]?.created_at || new Date().toISOString(),
    identityMode: false, // TODO: 如果未來需要，可以從 DB metadata 或 jobs 表查詢
  }
}

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

    const requestUrl = new URL(request.url)
    const paidParam = requestUrl.searchParams.get("paid")
    const isPaidFromQuery = paidParam === "1" || paidParam === "true"

    // ============================================================================
    // 1. Mock Job: jobId 以 "job_" 開頭
    // ============================================================================
    if (jobId.startsWith("job_")) {
      console.log("[api/results] Mock job detected (job_ prefix), returning mock images", { jobId })
      
      return NextResponse.json({
        ok: true,
        jobId,
        images: [
          { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
          { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          { id: 3, url: "/assets/mock/family3.jpg", thumbnail: "/assets/mock/family3.jpg" },
        ],
        paymentStatus: isPaidFromQuery ? "paid" : "unpaid",
        createdAt: new Date().toISOString(),
        provider: "mock",
        isMock: true,
      })
    }

    // ============================================================================
    // 2. Runware Job: jobId 以 "rw_" 開頭
    // 完全依賴 Supabase DB，不再調用 Runware API
    // ============================================================================
    if (jobId.startsWith("rw_")) {
      console.log(`[api/results] Runware job detected (rw_ prefix), fetching from Supabase DB for job ${jobId}`)
      
      try {
        const result = await fetchRunwareJobImages(jobId)
        
        // 如果 query string 有 paid=1，優先使用 query 參數
        const paymentStatus = isPaidFromQuery ? "paid" : result.paymentStatus

        // 記錄 analytics 事件
        try {
          const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          await logAnalyticsEvent({
            event_type: "results_ok",
            request_id: requestId,
            job_id: jobId,
            user_id: null,
            data: {
              image_count: result.images.length,
              model_provider: "runware",
              model_id: null,
              payment_status: paymentStatus,
            },
          })
        } catch (analyticsError) {
          // Analytics 失敗不影響主流程
          console.warn(`[api/results] Failed to log analytics for job ${jobId}:`, analyticsError)
        }

        return NextResponse.json({
          ok: true,
          jobId,
          images: result.images,
          paymentStatus,
          createdAt: result.createdAt,
          provider: "runware",
          isMock: false,
          identityMode: result.identityMode,
        })
      } catch (error: any) {
        // 錯誤處理：記錄詳細錯誤並返回 500
        console.error(`[api/results] Error fetching Runware job results for ${jobId}:`, {
          error: error.message,
          stack: error.stack,
          jobId,
        })
        
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to fetch job results",
            jobId,
          },
          { status: 500 }
        )
      }
    }

    // ============================================================================
    // 3. Demo Job: demo-001（保持現有行為）
    // ============================================================================
    if (isDemoJob(jobId)) {
      return NextResponse.json({
        ok: true,
        jobId,
        images: [
          { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
          { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
        ],
        paymentStatus: isPaidFromQuery ? "paid" : "unpaid",
        createdAt: new Date().toISOString(),
        provider: "mock",
        isMock: true,
      })
    }

    // ============================================================================
    // 4. 其他 jobId：向後兼容的現有邏輯
    // ============================================================================
    // 這裡保留原有的複雜邏輯（e2eStore, MockProvider, RunwareProvider 等）
    // 以確保向後兼容性

    const { runwareMode, isPreviewEnv } = await import("@/lib/featureFlags")
    const isRunwareJob = !isDemoJob(jobId) && runwareMode === "real"
    const providerType = getProviderType()
    const useMock = providerType === "mock" || isPreviewEnv

    // 如果確定是 Runware job 且不在 mock 模式，嘗試使用 RunwareProvider
    if (isRunwareJob && !useMock) {
      try {
        const { createRunwareProvider } = await import("@/lib/generation/providers/runware")
        const runwareProvider = createRunwareProvider()
        
        const results = await runwareProvider.getResults(jobId, { paid: isPaidFromQuery })
        
        const normalizedImages = results.images.map((url, idx) => ({
          id: idx + 1,
          url,
          thumbnail: url,
        }))

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        await logAnalyticsEvent({
          event_type: "results_ok",
          request_id: requestId,
          job_id: jobId,
          user_id: null,
          data: {
            image_count: normalizedImages.length,
            model_provider: "runware",
            model_id: null,
            payment_status: results.paymentStatus,
          },
        })

        return NextResponse.json({
          ok: true,
          jobId,
          images: normalizedImages,
          paymentStatus: results.paymentStatus || "unpaid",
          createdAt: new Date().toISOString(),
          provider: "runware",
          isMock: false,
        })
      } catch (error: any) {
        console.error("[api/results] RunwareProvider.getResults failed:", error)
        // Fall through to mock provider below
      }
    }

    // Mock 模式或 fallback：使用 e2eStore 和 MockProvider
    if (useMock || !isRunwareJob) {
      const job = e2eStore.jobs.get(jobId)
      const mockPreviewUrls = generateMockPreviewUrls(3)
      const mockImages = mockPreviewUrls.map((url, idx) => ({
        id: idx + 1,
        url,
        thumbnail: url,
      }))

      if (!job) {
        const paid = isPaidFromQuery || [...e2eStore.orders.values()].some(
          (o) => o.job_id === jobId && o.status === "paid"
        )

        const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
        const qualityScores = calculateQualityScores(forceLowQuality)
        const needsVoucher = shouldIssueVoucher(qualityScores)

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (needsVoucher && user) {
          const voucher = generateVoucher(jobId, user.id)
          await logAnalyticsEvent({
            event_type: "voucher_issued",
            job_id: jobId,
            user_id: user.id,
            data: {
              voucher_id: voucher.id,
              voucher_type: voucher.type,
              expires_at: voucher.expires_at,
              quality_scores: qualityScores,
            },
          })
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const falApiKey = process.env.FAL_API_KEY
        const falModelId = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
        const modelProvider = useMock ? "mock" : (falApiKey ? "fal" : "degraded")
        const modelId = useMock ? null : (falApiKey ? falModelId : null)
        
        await logAnalyticsEvent({
          event_type: "results_ok",
          request_id: requestId,
          job_id: jobId,
          user_id: user?.id || null,
          data: {
            image_count: mockImages.length,
            quality_scores: qualityScores,
            voucher_issued: needsVoucher,
            model_provider: modelProvider,
            model_id: modelId,
          },
        })

        await logAnalyticsEvent({
          event_type: "preview_view",
          request_id: requestId,
          job_id: jobId,
          user_id: user?.id || null,
          data: {
            image_count: mockImages.length,
            preview_size: 1024,
            has_watermark: !paid,
          },
        })

        return NextResponse.json({
          ok: true,
          jobId,
          images: mockImages,
          paymentStatus: paid ? "paid" : "unpaid",
          createdAt: new Date().toISOString(),
          qualityScores,
          voucherIssued: needsVoucher,
        })
      }

      // Job exists in e2eStore
      const paid = isPaidFromQuery || [...e2eStore.orders.values()].some(
        (o) => o.job_id === jobId && o.status === "paid"
      )

      const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
      const qualityScores = calculateQualityScores(forceLowQuality)
      const needsVoucher = shouldIssueVoucher(qualityScores)

      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (needsVoucher && user) {
        const voucher = generateVoucher(jobId, user.id)
        await logAnalyticsEvent({
          event_type: "voucher_issued",
          job_id: jobId,
          user_id: user.id,
          data: {
            voucher_id: voucher.id,
            voucher_type: voucher.type,
            expires_at: voucher.expires_at,
            quality_scores: qualityScores,
          },
        })
      }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const falApiKey = process.env.FAL_API_KEY
        const falModelId = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
        const modelProvider = useMock ? "mock" : (falApiKey ? "fal" : "degraded")
        const modelId = useMock ? null : (falApiKey ? falModelId : null)
        
        await logAnalyticsEvent({
          event_type: "results_ok",
          request_id: requestId,
          job_id: jobId,
          user_id: user?.id || null,
          data: {
            image_count: (job.result_urls || []).length,
            quality_scores: qualityScores,
            voucher_issued: needsVoucher,
            model_provider: modelProvider,
            model_id: modelId,
          },
        })

      await logAnalyticsEvent({
        event_type: "preview_view",
        request_id: requestId,
        job_id: jobId,
        user_id: user?.id || null,
        data: {
          image_count: (job.result_urls || []).length,
          preview_size: 1024,
          has_watermark: !paid,
        },
      })

      const imageUrls = (job.result_urls || []).map((url: any) =>
        typeof url === "string" ? url : url.url || url
      )
      const finalImages = imageUrls.length > 0 ? imageUrls : mockImages.map(img => img.url)

      return NextResponse.json({
        ok: true,
        jobId,
        images: finalImages.map((url, idx) => ({
          id: idx + 1,
          url,
          thumbnail: url,
        })),
        paymentStatus: paid ? "paid" : "unpaid",
        createdAt: new Date().toISOString(),
        qualityScores,
        voucherIssued: needsVoucher,
      })
    }

    // 最後的 fallback：使用 Provider 系統
    const provider = getGenerationProvider()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (provider.name === "runware") {
      try {
        const { data: job } = await supabase
          .from("jobs")
          .select("order_id")
          .eq("job_id", jobId)
          .eq("user_id", user.id)
          .single()

        let paid = isPaidFromQuery
        if (job?.order_id) {
          const { data: order } = await supabase
            .from("orders")
            .select("payment_status")
            .eq("id", job.order_id)
            .single()

          if (order) {
            paid = order.payment_status === "paid" || paid
          }
        }

        const results = await provider.getResults(jobId, { paid })

        const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
        const qualityScores = calculateQualityScores(forceLowQuality)
        const needsVoucher = shouldIssueVoucher(qualityScores)

        if (needsVoucher && user) {
          const voucher = generateVoucher(jobId, user.id)
          await logAnalyticsEvent({
            event_type: "voucher_issued",
            job_id: jobId,
            user_id: user.id,
            data: {
              voucher_id: voucher.id,
              voucher_type: voucher.type,
              expires_at: voucher.expires_at,
              quality_scores: qualityScores,
            },
          })
        }

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        await logAnalyticsEvent({
          event_type: "results_ok",
          request_id: requestId,
          job_id: jobId,
          user_id: user.id,
          data: {
            image_count: results.images.length,
            quality_scores: qualityScores,
            voucher_issued: needsVoucher,
            model_provider: "runware",
            model_id: null,
          },
        })

        await logAnalyticsEvent({
          event_type: "preview_view",
          request_id: requestId,
          job_id: jobId,
          user_id: user.id,
          data: {
            image_count: results.images.length,
            preview_size: 1024,
            has_watermark: !paid,
          },
        })

        const { data: jobData } = await supabase
          .from("jobs")
          .select("created_at")
          .eq("job_id", jobId)
          .single()

        const formattedImages = results.images.map((url, idx) => ({
          id: idx + 1,
          url,
          thumbnail: url,
        }))

        return NextResponse.json({
          ok: true,
          jobId,
          images: formattedImages,
          paymentStatus: paid ? "paid" : "unpaid",
          createdAt: jobData?.created_at || new Date().toISOString(),
          qualityScores,
          voucherIssued: needsVoucher,
        })
      } catch (error: any) {
        console.error("[api/results] Error in RunwareProvider.getResults:", error)
        return NextResponse.json(
          { ok: false, error: "Failed to fetch results", jobId },
          { status: 500 }
        )
      }
    }

    // 最後的 fallback：直接查詢 Supabase
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("job_id, status, created_at, order_id")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { ok: false, error: "Job not found", jobId },
        { status: 404 }
      )
    }

    const { data: images, error: imagesError } = await supabase
      .from("job_images")
      .select("id, image_url, thumbnail_url")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    if (imagesError) {
      console.error(`[api/results] Error fetching images for job ${jobId}:`, {
        error: imagesError.message,
        code: imagesError.code,
      })
      return NextResponse.json(
        { ok: false, error: "Failed to fetch images", jobId },
        { status: 500 }
      )
    }

    let paymentStatus: "paid" | "unpaid" = "unpaid"
    if (isPaidFromQuery) {
      paymentStatus = "paid"
    } else if (job.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", job.order_id)
        .single()

      if (order) {
        paymentStatus = order.payment_status === "paid" ? "paid" : "unpaid"
      }
    }

    const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
    const qualityScores = calculateQualityScores(forceLowQuality)
    const needsVoucher = shouldIssueVoucher(qualityScores)

    if (needsVoucher && user) {
      const voucher = generateVoucher(jobId, user.id)
      await logAnalyticsEvent({
        event_type: "voucher_issued",
        job_id: jobId,
        user_id: user.id,
        data: {
          voucher_id: voucher.id,
          voucher_type: voucher.type,
          expires_at: voucher.expires_at,
          quality_scores: qualityScores,
        },
      })
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    await logAnalyticsEvent({
      event_type: "results_ok",
      request_id: requestId,
      job_id: jobId,
      user_id: user.id,
      data: {
        image_count: images?.length || 0,
        quality_scores: qualityScores,
        voucher_issued: needsVoucher,
        model_provider: "unknown",
        model_id: null,
      },
    })

    await logAnalyticsEvent({
      event_type: "preview_view",
      request_id: requestId,
      job_id: jobId,
      user_id: user.id,
      data: {
        image_count: images?.length || 0,
        preview_size: 1024,
        has_watermark: paymentStatus !== "paid",
      },
    })

    const formattedImages = (images || []).map((img, idx) => ({
      id: idx + 1,
      url: img.image_url, // 使用正確的欄位名稱
      thumbnail: img.thumbnail_url || img.image_url, // thumbnail_url 為 null 時 fallback
    }))

    return NextResponse.json({
      ok: true,
      jobId,
      images: formattedImages,
      paymentStatus,
      createdAt: job.created_at || new Date().toISOString(),
      qualityScores,
      voucherIssued: needsVoucher,
    })
  } catch (error: any) {
    console.error("[api/results] Unexpected error in results API:", {
      error: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * 記錄 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  job_id: string
  request_id?: string
  user_id?: string | null
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
        request_id: event.request_id || null,
        ...event.data,
      },
      user_id: event.user_id || null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log analytics event:", error)
    // 不拋出錯誤，避免影響主流程
  }
}


import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import e2eStore from "@/lib/e2eStore"
import { generateMockPreviewUrls } from "@/lib/generation/mock-state-machine"
import { calculateQualityScores, shouldIssueVoucher, generateVoucher } from "@/lib/generation/quality-scorer"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"

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

    // Route A: demo-001 固定返回 mock 图片，跳过登录验证（全 mock demo flow）
    // Route C: 根据 query string paid=1 返回 paid 状态
    if (jobId === "demo-001") {
      const requestUrl = new URL(request.url)
      const paidParam = requestUrl.searchParams.get("paid")
      const isPaid = paidParam === "1" || paidParam === "true"
      
      return NextResponse.json({
        jobId,
        images: [
          { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
          { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
        ],
        paymentStatus: isPaid ? "paid" : "unpaid",
        createdAt: new Date().toISOString(),
      })
    }

    // Check provider type (new system with backward compatibility)
    const providerType = getProviderType()
    const useMock = providerType === "mock"

    if (useMock) {
      // Mock 模式：嘗試使用 MockProvider，但保留現有邏輯作為 fallback
      // 因為 results API 有複雜的支付狀態、品質分數等邏輯
      // 暫時保留現有實作，確保行為一致
      // Check e2e store for job
      const job = e2eStore.jobs.get(jobId)
      
      // 生成 Mock 预览图
      const mockPreviewUrls = generateMockPreviewUrls(3)
      const mockImages = mockPreviewUrls.map((url, idx) => ({
        id: idx,
        url,
        thumbnail: url,
      }))

      if (!job) {
        // Fallback to mock results data for testing
        // Check for paid order even if job doesn't exist in store
        // 特殊處理：demo-001 支援 paid=1 query（用於 QA 測試）
        const requestUrl = new URL(request.url)
        const paidParam = requestUrl.searchParams.get("paid")
        const paidFromQuery = paidParam === "1" || paidParam === "true"
        
        const paid = paidFromQuery || [...e2eStore.orders.values()].some(
          (o) => o.job_id === jobId && o.status === "paid"
        )

        // 计算品质分数并检查是否需要发放重生成券
        const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
        const qualityScores = calculateQualityScores(forceLowQuality)
        const needsVoucher = shouldIssueVoucher(qualityScores)

        // 获取用户 ID（如果已登录）
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (needsVoucher && user) {
          // 发放重生成券
          const voucher = generateVoucher(jobId, user.id)
          
          // 记录到 analytics_logs（先不建表，用 analytics_logs 记录）
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

        // 记录 results_ok 事件
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

        // 记录 preview_view 事件
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
          jobId,
          images: mockImages,
          paymentStatus: paid ? "paid" : "unpaid",
          createdAt: new Date().toISOString(),
          qualityScores,
          voucherIssued: needsVoucher,
        })
      }

      // Check for paid order: 只要 e2eStore 中有該 job 的訂單且為 paid，就判定已付
      const paid = [...e2eStore.orders.values()].some(
        (o) => o.job_id === jobId && o.status === "paid"
      )

      // Debug log in development
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Results API] Job ${jobId}: paymentStatus=${paid ? "paid" : "unpaid"}, orders=${e2eStore.orders.size}`)
      }

      // 计算品质分数
      const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
      const qualityScores = calculateQualityScores(forceLowQuality)
      const needsVoucher = shouldIssueVoucher(qualityScores)

      // 获取用户 ID
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (needsVoucher && user) {
        // 发放重生成券
        const voucher = generateVoucher(jobId, user.id)
        
        // 记录到 analytics_logs
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

        // 记录 results_ok 事件
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

      // 记录 preview_view 事件
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

      // 處理 result_urls（可能是 string[] 或複雜物件）
      const imageUrls = (job.result_urls || []).map((url: any) => 
        typeof url === "string" ? url : url.url || url
      )
      const finalImages = imageUrls.length > 0 ? imageUrls : mockImages.map(img => img.url)

      return NextResponse.json({
        jobId,
        images: finalImages.map((url, idx) => ({
          id: idx,
          url,
          thumbnail: url,
        })),
        paymentStatus: paid ? "paid" : "unpaid",
        createdAt: new Date().toISOString(), // E2EJob 沒有 created_at 欄位
        qualityScores,
        voucherIssued: needsVoucher,
      })
    }

    // 使用 Provider 系統（Mock 或 Runware）
    const provider = getGenerationProvider()
    
    // 如果是 Mock Provider，保留現有邏輯（因為有複雜的支付狀態、品質分數等）
    if (provider.name === "mock") {
      // Mock 邏輯已在上面處理，這裡不需要額外處理
    } else if (provider.name === "runware") {
      // Runware Provider
      // Get current user
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      try {
        // 檢查支付狀態
        const { data: job } = await supabase
          .from("jobs")
          .select("order_id")
          .eq("id", jobId)
          .eq("user_id", user.id)
          .single()

        let paid = false
        if (job?.order_id) {
          const { data: order } = await supabase
            .from("orders")
            .select("payment_status")
            .eq("id", job.order_id)
            .single()

          if (order) {
            paid = order.payment_status === "paid"
          }
        }

        const results = await provider.getResults(jobId, { paid })
        
        // 计算品质分数（非 Mock 模式）
        const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
        const qualityScores = calculateQualityScores(forceLowQuality)
        const needsVoucher = shouldIssueVoucher(qualityScores)

        if (needsVoucher && user) {
          // 发放重生成券
          const voucher = generateVoucher(jobId, user.id)
          
          // 记录到 analytics_logs
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

        // 记录 results_ok 事件
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

        // 记录 preview_view 事件
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

        // Fetch job created_at
        const { data: jobData } = await supabase
          .from("jobs")
          .select("created_at")
          .eq("id", jobId)
          .single()

        // 轉換 images 格式（ResultsResult.images 是 string[]，但 API 需要 { id, url, thumbnail }[]）
        const formattedImages = results.images.map((url, idx) => ({
          id: idx,
          url,
          thumbnail: url,
        }))

        return NextResponse.json({
          jobId,
          images: formattedImages,
          paymentStatus: paid ? "paid" : "unpaid",
          createdAt: jobData?.created_at || new Date().toISOString(),
          qualityScores,
          voucherIssued: needsVoucher,
        })
      } catch (error: any) {
        console.error("Error in RunwareProvider.getResults:", error)
        return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
      }
    }

    // 其他非 Mock 模式：使用現有邏輯（向後兼容）
    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch job and results from database
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, created_at, order_id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Fetch images for this job
    const { data: images, error: imagesError } = await supabase
      .from("job_images")
      .select("id, url, thumbnail_url")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    if (imagesError) {
      console.error("Error fetching images:", imagesError)
    }

    // Fetch payment status from order if exists
    let paymentStatus = "unpaid"
    if (job.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", job.order_id)
        .single()

      if (order) {
        paymentStatus = order.payment_status || "unpaid"
      }
    }

    // Format images to match API structure: { url }
    const formattedImages = (images || []).map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail_url || img.url,
    }))

    // 计算品质分数（非 Mock 模式）
    const forceLowQuality = process.env.FORCE_LOW_QUALITY === "true"
    const qualityScores = calculateQualityScores(forceLowQuality)
    const needsVoucher = shouldIssueVoucher(qualityScores)

    if (needsVoucher && user) {
      // 发放重生成券
      const voucher = generateVoucher(jobId, user.id)
      
      // 记录到 analytics_logs
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

    // 记录 results_ok 事件
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const falApiKey = process.env.FAL_API_KEY
    const falModelId = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
    const modelProvider = useMock ? "mock" : (falApiKey ? "fal" : "degraded")
    const modelId = useMock ? null : (falApiKey ? falModelId : null)
    
    await logAnalyticsEvent({
      event_type: "results_ok",
      request_id: requestId,
      job_id: jobId,
      user_id: user.id,
      data: {
        image_count: formattedImages.length,
        quality_scores: qualityScores,
        voucher_issued: needsVoucher,
        model_provider: modelProvider,
        model_id: modelId,
      },
    })

    // 记录 preview_view 事件
    await logAnalyticsEvent({
      event_type: "preview_view",
      request_id: requestId,
      job_id: jobId,
      user_id: user.id,
      data: {
        image_count: formattedImages.length,
        preview_size: 1024,
        has_watermark: paymentStatus !== "paid",
      },
    })

    return NextResponse.json({
      jobId,
      images: formattedImages,
      paymentStatus,
      createdAt: job.created_at || new Date().toISOString(),
      qualityScores,
      voucherIssued: needsVoucher,
    })
  } catch (error) {
    console.error("Error in results API:", error)
    return NextResponse.json(
      { error: "Failed to fetch results" },
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
    // 不抛出错误，避免影响主流程
  }
}

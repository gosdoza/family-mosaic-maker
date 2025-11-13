import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { capturePayPalOrder, mapPayPalStatusToInternal } from "@/lib/paypal/client"
import { updateOrderPaidByJob } from "@/lib/orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CAPTURE_TIMEOUT_MS = 10000 // 10 秒超时
const MAX_RETRIES = 2 // 最多重试 2 次
const RETRY_DELAY_MS = 1000 // 初始重试延迟 1 秒

/**
 * POST /api/paypal/capture
 * 
 * 捕获 PayPal 支付
 * 支持超时重试
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", request_id: requestId },
        { status: 401 }
      )
    }

    // 2. 解析请求体
    const body = await request.json()
    const { orderId, jobId } = body

    if (!orderId || !jobId) {
      return NextResponse.json(
        { error: "orderId and jobId are required", request_id: requestId },
        { status: 400 }
      )
    }

    // 3. 尝试捕获支付（带重试）
    let captureResult: any
    let attempt = 0
    let lastError: Error | null = null

    while (attempt <= MAX_RETRIES) {
      try {
        // 创建带超时的 AbortController
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS)

        try {
          captureResult = await capturePayPalOrder(orderId)
          clearTimeout(timeoutId)
          break // 成功，退出循环
        } catch (error: any) {
          clearTimeout(timeoutId)
          throw error
        }
      } catch (error: any) {
        lastError = error

        // 如果是最后一次尝试，抛出错误
        if (attempt === MAX_RETRIES) {
          throw error
        }

        // 记录重试事件
        await logAnalyticsEvent({
          event_type: "payment_retry",
          request_id: requestId,
          user_id: user.id,
          data: {
            job_id: jobId,
            order_id: orderId,
            attempt: attempt + 1,
            error: error.message,
          },
        })

        // 指数退避重试
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
        attempt++
      }
    }

    if (!captureResult) {
      throw lastError || new Error("Capture failed after retries")
    }

    // 4. 映射 PayPal 状态到内部状态
    const internalStatus = mapPayPalStatusToInternal(captureResult.status)

    // 5. 更新订单状态
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

    const captureId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id
    const payerEmail = captureResult.payer?.email_address

    await serviceClient
      .from("orders")
      .update({
        status: internalStatus,
        paypal_capture_id: captureId,
        payer_email: payerEmail,
        paid_at: internalStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId)
      .eq("paypal_order_id", orderId)

    // 6. 如果支付成功，更新 assets.paid=true
    if (internalStatus === "paid") {
      await serviceClient
        .from("assets")
        .update({ paid: true })
        .eq("job_id", jobId)
    }

    // 7. 记录成功事件
    await logAnalyticsEvent({
      event_type: "payment_capture_ok",
      request_id: requestId,
      user_id: user.id,
      data: {
        job_id: jobId,
        order_id: orderId,
        capture_id: captureId,
        status: internalStatus,
        retry_count: attempt,
      },
    })

    return NextResponse.json({
      success: true,
      status: internalStatus,
      captureId,
      request_id: requestId,
    })
  } catch (error: any) {
    console.error("Error in PayPal capture API:", error)
    
    // 记录错误事件
    await logAnalyticsEvent({
      event_type: "payment_capture_fail",
      request_id: requestId,
      user_id: null,
      error: "capture_error",
      data: {
        message: error.message,
      },
    })

    return NextResponse.json(
      { error: "Failed to capture payment", request_id: requestId },
      { status: 500 }
    )
  }
}

/**
 * 记录 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  request_id: string
  user_id: string | null
  error?: string
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
        request_id: event.request_id,
        error: event.error,
        ...event.data,
      },
      user_id: event.user_id,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log analytics event:", error)
    // 不抛出错误，避免影响主流程
  }
}




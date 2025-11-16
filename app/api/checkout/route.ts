import { NextRequest, NextResponse } from "next/server"
import { IS_MOCK } from "@/lib/config"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createOrderRecord } from "@/lib/orders"
import { createPayPalOrder } from "@/lib/paypal/client"
import { checkIdempotencyKey, saveIdempotencyKey } from "@/lib/paypal/idempotency"
import e2eStore from "@/lib/e2eStore"
import { isDemoJob, isPaypalMock, isDemoMode } from "@/lib/featureFlags"

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  
  try {
    // 1. 检查幂等性 Key
    const idempotencyKey = request.headers.get("X-Idempotency-Key")
    
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "X-Idempotency-Key header is required", request_id: requestId },
        { status: 400 }
      )
    }

    // 2. 检查幂等性 Key 是否已使用（測試環境和生產環境都使用統一的 checkIdempotencyKey，它會根據環境自動選擇存儲方式）
    const idempotencyCheck = await checkIdempotencyKey(idempotencyKey)
    
    if (idempotencyCheck.exists) {
      // 记录 checkout_init 事件（重复请求）
      await logAnalyticsEvent({
        event_type: "checkout_init",
        request_id: requestId,
        user_id: null,
        error: "idempotency_key_exists",
        data: {
          idempotency_key: idempotencyKey,
          existing_order_id: idempotencyCheck.orderId,
        },
      })

      return NextResponse.json(
        {
          error: "Idempotency key already used",
          orderId: idempotencyCheck.orderId,
          request_id: requestId,
        },
        { status: 409 }
      )
    }

    // 4. 解析请求体
    const body = await request.json()
    const { jobId, price } = body

    if (!jobId || !price) {
      return NextResponse.json(
        { error: "jobId and price are required", request_id: requestId },
        { status: 400 }
      )
    }

    // Route C: demo-001 免登录放行（mock demo flow）
    // NOTE: behavior preserved, just using centralized feature flags
    const isDemo = isDemoJob(jobId)
    
    // 3. 验证用户身份（demo-001 例外）
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!isDemo && (authError || !user)) {
      return NextResponse.json(
        { error: "Unauthorized", request_id: requestId },
        { status: 401 }
      )
    }

    // 5. 记录 checkout_init 事件
    await logAnalyticsEvent({
      event_type: "checkout_init",
      request_id: requestId,
      user_id: user?.id || null,
      data: {
        job_id: jobId,
        price,
        idempotency_key: idempotencyKey,
        is_demo: isDemo,
      },
    })

    // 6. 檢查是否使用 Mock 模式或測試環境
    // NOTE: behavior preserved, just using centralized feature flags
    const useMock = IS_MOCK || isDemoMode
    const isTestMode = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_LOGIN === 'true'
    
    // Route C: demo-001 直接返回 mock approvalUrl（不需要真实 PayPal）
    if (isDemo) {
      const requestUrl = new URL(request.url)
      const approvalUrl = `${requestUrl.origin}/results/${jobId}?paid=1&mock=1`
      
      // 记录 checkout_ok 事件
      await logAnalyticsEvent({
        event_type: "checkout_ok",
        request_id: requestId,
        user_id: user?.id || null,
        data: {
          job_id: jobId,
          order_id: `demo-order-${Date.now()}`,
          price,
          mode: "mock-demo",
        },
      })
      
      return NextResponse.json({
        approvalUrl,
        provider: "paypal-mock",
        jobId,
        request_id: requestId,
      })
    }
    
    // 測試環境專用成功路徑（不影響 production）
    if (isTestMode) {
      // 保存 idempotency key 到 idempotency store，以便重放時檢查
      const testOrderId = 'TEST_ORDER_001'
      await saveIdempotencyKey(idempotencyKey, testOrderId, "created")
      
      const testApprovalUrl = 'https://www.sandbox.paypal.com/checkoutnow?token=TEST_ORDER_001'
      console.log('[checkout] test-mode mock response', {
        orderId: testOrderId,
        approvalUrl: testApprovalUrl,
        idempotencyKey,
      })
      return NextResponse.json(
        {
          ok: true,
          provider: 'paypal',
          orderId: testOrderId,
          approvalUrl: testApprovalUrl,
          request_id: requestId,
        },
        { status: 200 },
      )
    }

    if (useMock) {
      // Mock 模式：建立 paid 訂單到 e2eStore
      const orderId = `ord_${Date.now()}`
      e2eStore.orders.set(orderId, {
        id: orderId,
        job_id: jobId,
        status: "paid",
        provider: "paypal",
        provider_ref: "mock-capture",
        user_id: user.id,
        idempotency_key: idempotencyKey,
      })

      // Also create order record in database (if needed for non-mock compatibility)
      try {
        const order = await createOrderRecord({
          jobId,
          status: "paid",
          amountCents: Math.round(parseFloat(price) * 100),
          currency: "USD",
        })

        // 保存幂等性 Key
        await saveIdempotencyKey(idempotencyKey, order.id, "paid")

        // 记录 checkout_ok 事件
        await logAnalyticsEvent({
          event_type: "checkout_ok",
          request_id: requestId,
          user_id: user.id,
          data: {
            job_id: jobId,
            order_id: order.id,
            price,
            mode: "mock",
          },
        })

        // 使用 request URL 的 origin 構建完整的 approvalUrl（避免硬編碼 domain）
        const requestUrl = new URL(request.url)
        const approvalUrl = `${requestUrl.origin}/results?id=${jobId}&paid=1`

        return NextResponse.json({
          approvalUrl,
          orderId: order.id,
          jobId,
          request_id: requestId,
        })
      } catch (e) {
        // Ignore database errors in mock mode
        console.warn("[Checkout] Database order creation failed in mock mode:", e)
      }

      // 记录 checkout_ok 事件
      await logAnalyticsEvent({
        event_type: "checkout_ok",
        request_id: requestId,
        user_id: user.id,
        data: {
          job_id: jobId,
          order_id: orderId,
          price,
          mode: "mock",
        },
      })

      // 使用 request URL 的 origin 構建完整的 approvalUrl（避免硬編碼 domain）
      const requestUrl = new URL(request.url)
      const approvalUrl = `${requestUrl.origin}/results?id=${jobId}&paid=1`

      return NextResponse.json({
        approvalUrl,
        orderId,
        jobId,
        request_id: requestId,
      })
    }

    // 7. 非 Mock 模式：创建 PayPal 订单
    try {
      const paypalOrder = await createPayPalOrder({
        jobId,
        amount: price,
        currency: "USD",
        idempotencyKey,
      })

      // 8. 获取 approval URL
      const approvalLink = paypalOrder.links.find((link: any) => link.rel === "approve")
      if (!approvalLink) {
        throw new Error("No approval URL found in PayPal order")
      }

      // 9. 在数据库中创建订单记录
      const order = await createOrderRecord({
        jobId,
        status: "pending",
        amountCents: Math.round(parseFloat(price) * 100),
        currency: "USD",
        approvalUrl: approvalLink.href,
      })

      // 10. 更新订单的 PayPal Order ID 和幂等性 Key
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

      await serviceClient
        .from("orders")
        .update({
          paypal_order_id: paypalOrder.id,
          idempotency_key: idempotencyKey,
        })
        .eq("id", order.id)

      // 11. 保存幂等性 Key
      await saveIdempotencyKey(idempotencyKey, order.id, "pending")

      // 12. 记录 checkout_ok 事件
      await logAnalyticsEvent({
        event_type: "checkout_ok",
        request_id: requestId,
        user_id: user.id,
        data: {
          job_id: jobId,
          order_id: order.id,
          paypal_order_id: paypalOrder.id,
          price,
          mode: "paypal",
        },
      })

      return NextResponse.json({
        approvalUrl: approvalLink.href,
        orderId: order.id,
        jobId,
        request_id: requestId,
      })
    } catch (error: any) {
      console.error("PayPal order creation failed:", error)
      
      // 记录错误事件
      await logAnalyticsEvent({
        event_type: "checkout_init",
        request_id: requestId,
        user_id: user.id,
        error: "paypal_error",
        data: {
          job_id: jobId,
          message: error.message,
        },
      })

      throw error
    }
  } catch (error: any) {
    console.error("Error in checkout API:", error)
    return NextResponse.json(
      { error: "Failed to process checkout", request_id: requestId },
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


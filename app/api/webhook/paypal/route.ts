import { NextRequest, NextResponse } from "next/server"
import { IS_MOCK, PAYPAL_WEBHOOK_ID } from "@/lib/config"
import { recordWebhookEvent, hasWebhookEventBeenProcessed } from "@/lib/orders"
import { verifyPayPalWebhookSignature } from "@/lib/paypal-webhook"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.json()

    const eventId = body?.id || body?.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const eventType = body?.event_type || body?.eventType || "UNKNOWN"
    const resourceId = body?.resource?.id || body?.resource_id || null

    // Get jobId from resource.custom_id or query parameter
    const jobId =
      body?.resource?.custom_id ||
      body?.resource?.supplementary_data?.related_ids?.custom_id ||
      new URL(request.url).searchParams.get("jobId") ||
      "demo-001"

    // Idempotency: Check if this event has already been processed
    const alreadyProcessed = await hasWebhookEventBeenProcessed(eventId)
    if (alreadyProcessed) {
      console.log(`Webhook event ${eventId} already processed, returning 200 (idempotency)`)
      return NextResponse.json(
        { status: "already_processed", success: true, message: "Event already processed" },
        { status: 200 }
      )
    }

    // Verify PayPal webhook signature (skip in mock mode)
    if (!IS_MOCK && PAYPAL_WEBHOOK_ID) {
      const isValid = await verifyPayPalWebhookSignature(
        request.headers,
        body,
        PAYPAL_WEBHOOK_ID
      )

      if (!isValid) {
        console.error(`PayPal webhook signature verification failed for event ${eventId}`)
        // Still return 200 to prevent PayPal from retrying
        // But log the error for monitoring
        return NextResponse.json(
          { error: "Invalid signature", success: false },
          { status: 200 }
        )
      }
    }

    // Record webhook event for idempotency
    await recordWebhookEvent(eventId, resourceId, eventType)

    // Process PAYMENT.CAPTURE.COMPLETED event
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const captureId = body?.resource?.id || resourceId
      const paypalOrderId =
        body?.resource?.supplementary_data?.related_ids?.order_id ||
        body?.resource?.supplementary_data?.related_ids?.order_id ||
        null
      const payerEmail = body?.resource?.payer?.email_address || null

      // Get user_id from job
      const supabase = await createClient()
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("id, user_id")
        .eq("id", jobId)
        .maybeSingle()

      if (jobError) {
        console.error("Error fetching job for webhook:", jobError)
        return NextResponse.json(
          { error: "Failed to fetch job", success: false },
          { status: 200 }
        )
      }

      if (!job) {
        console.error(`Job ${jobId} not found for webhook event ${eventId}`)
        return NextResponse.json(
          { error: "Job not found", success: false },
          { status: 200 }
        )
      }

      const userId = job.user_id

      // Upsert into orders table
      // Note: Using paypal_capture_id as provider_ref (stored in paypal_capture_id column)
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .upsert(
          {
            job_id: jobId,
            status: "paid",
            paypal_capture_id: captureId, // This acts as provider_ref
            paypal_order_id: paypalOrderId,
            payer_email: payerEmail,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "job_id",
            ignoreDuplicates: false,
          }
        )
        .select()
        .single()

      if (orderError) {
        console.error("Error upserting order in webhook:", orderError)
        return NextResponse.json(
          { error: "Failed to update order", success: false },
          { status: 200 }
        )
      }

      // 更新 assets.paid=true（解锁资产）
      const { error: assetsUpdateError } = await supabase
        .from("assets")
        .update({ paid: true })
        .eq("job_id", jobId)

      if (assetsUpdateError) {
        console.warn("Failed to update assets paid flag:", assetsUpdateError)
      }

      // 检查用户是否在线（通过检查最近的会话）
      // 如果用户掉线，需要补发凭证
      const { data: recentSession } = await supabase
        .from("analytics_logs")
        .select("user_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const userOffline = !recentSession || 
        (Date.now() - new Date(recentSession.created_at).getTime()) > 5 * 60 * 1000 // 5 分钟无活动视为掉线

      if (userOffline) {
        // 补发凭证（记录到 analytics_logs）
        await logAnalyticsEvent({
          event_type: "webhook_reissue",
          user_id: userId,
          data: {
            job_id: jobId,
            order_id: order?.id,
            capture_id: captureId,
            reason: "user_offline",
          },
        })
      }

      // 记录 webhook_ok 事件
      await logAnalyticsEvent({
        event_type: "webhook_ok",
        user_id: userId,
        data: {
          job_id: jobId,
          order_id: order?.id,
          capture_id: captureId,
          event_id: eventId,
          user_offline: userOffline,
        },
      })

      console.log(`PayPal payment completed: ${eventType}, job: ${jobId}, order: ${order?.id}`)
    }

    return NextResponse.json(
      { success: true, message: "Webhook processed successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error processing PayPal webhook:", error)
    // Return 200 to prevent PayPal from retrying
    return NextResponse.json(
      { error: "Failed to process webhook", success: false },
      { status: 200 }
    )
  }
}

/**
 * 记录 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  user_id: string
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
      event_data: event.data || {},
      user_id: event.user_id,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log analytics event:", error)
    // 不抛出错误，避免影响主流程
  }
}

import { NextRequest, NextResponse } from "next/server"
import { IS_MOCK, PAYPAL_WEBHOOK_ID } from "@/lib/config"
import { recordWebhookEvent, hasWebhookEventBeenProcessed } from "@/lib/orders"
import { verifyPayPalWebhookSignature } from "@/lib/paypal-webhook"
import { createClient } from "@/lib/supabase/server"

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

      // Optionally set job flag paid=true for quick checks
      // Note: This assumes jobs table has a 'paid' boolean column
      // If not, you can skip this step or add the column via migration
      const { error: jobUpdateError } = await supabase
        .from("jobs")
        .update({ paid: true, updated_at: new Date().toISOString() })
        .eq("id", jobId)

      if (jobUpdateError) {
        // Log but don't fail - this is optional
        console.warn("Failed to update job paid flag (optional):", jobUpdateError)
      }

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

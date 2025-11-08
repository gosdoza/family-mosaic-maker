import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if we're using mock mode
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

    if (useMock) {
      // Log webhook in mock mode
      console.log("Received payment webhook (mock):", body)
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    // TODO: Verify PayPal webhook signature
    // const isValid = verifyPayPalWebhook(body, request.headers)
    // if (!isValid) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    // }

    const supabase = await createClient()

    // Handle different PayPal event types
    if (
      body.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
      body.event_type === "CHECKOUT.ORDER.APPROVED"
    ) {
      const paymentId = body.resource?.id
      const orderId = body.resource?.purchase_units?.[0]?.reference_id

      if (!orderId) {
        console.error("No order ID in webhook:", body)
        return NextResponse.json({ error: "No order ID" }, { status: 400 })
      }

      // Update order payment status
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (updateError) {
        console.error("Error updating order:", updateError)
        return NextResponse.json(
          { error: "Failed to update order" },
          { status: 500 }
        )
      }

      // Get job ID from order
      const { data: order } = await supabase
        .from("orders")
        .select("job_id")
        .eq("id", orderId)
        .single()

      if (order?.job_id) {
        // TODO: Generate HD images and update job_images with HD URLs
        // await generateHDImages(order.job_id)

        // For now, just log
        console.log(`Payment completed for job ${order.job_id}`)
      }

      console.log(
        `PayPal transaction successful! Payment ID: ${paymentId}, Order ID: ${orderId}`
      )
    } else {
      console.log(`Unhandled PayPal event type: ${body.event_type}`)
    }

    return NextResponse.json({ status: "success" }, { status: 200 })
  } catch (error) {
    console.error("Error processing payment webhook:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}


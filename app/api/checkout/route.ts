import { NextRequest, NextResponse } from "next/server"
import { IS_MOCK } from "@/lib/config"
import { createOrderRecord } from "@/lib/orders"
import e2eStore from "@/lib/e2eStore"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product, jobId } = body

    // Validate request
    if (!product || !jobId) {
      return NextResponse.json(
        { error: "Product and jobId are required" },
        { status: 400 }
      )
    }

    // Check if we're using mock mode
    const useMock = IS_MOCK || process.env.NEXT_PUBLIC_USE_MOCK === "true"

    if (useMock) {
      // 建立 paid 訂單到 e2eStore
      const orderId = `ord_${Date.now()}`
      e2eStore.orders.set(orderId, {
        id: orderId,
        job_id: jobId,
        status: "paid",
        provider: "paypal",
        provider_ref: "mock-capture",
        user_id: "e2e-user",
      })

      // Also create order record in database (if needed for non-mock compatibility)
      try {
        await createOrderRecord({
          jobId,
          status: "paid",
          amountCents: 299, // $2.99
          currency: "USD",
        })
      } catch (e) {
        // Ignore database errors in mock mode
        console.warn("[Checkout] Database order creation failed in mock mode:", e)
      }

      // Return approvalUrl in format /results?id=${jobId}&paid=1
      return NextResponse.json({
        approvalUrl: `/results?id=${jobId}&paid=1`,
        orderId,
        jobId,
      })
    }

    // TODO: Integrate with PayPal SDK
    // 1. Create PayPal order
    // 2. Get approval URL from PayPal
    // 3. Store order in database with status='pending'
    // 4. Return approval URL

    // For now, return a mock response (will be replaced with real PayPal integration)
    const order = await createOrderRecord({
      jobId,
      status: "pending",
      amountCents: 299,
      currency: "USD",
    })

    return NextResponse.json({
      approvalUrl: `/results?id=${jobId}&paid=1`, // Temporary for development
      orderId: order.id,
      jobId,
    })
  } catch (error) {
    console.error("Error in checkout API:", error)
    return NextResponse.json(
      { error: "Failed to process checkout" },
      { status: 500 }
    )
  }
}


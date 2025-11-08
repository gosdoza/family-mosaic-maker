import { NextRequest, NextResponse } from "next/server"
import { IS_MOCK } from "@/lib/config"
import { createOrderRecord } from "@/lib/orders"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan, amount, jobId } = body

    if (!plan || !amount) {
      return NextResponse.json(
        { error: "Plan and amount are required" },
        { status: 400 }
      )
    }

    const resultJobId = jobId || "demo-001"
    const approvalUrl = `/results/${resultJobId}?paid=1`

    if (IS_MOCK) {
      // In mock mode: create a paid order immediately
      const order = await createOrderRecord({
        jobId: resultJobId,
        status: "paid",
        approvalUrl,
        amountCents: Math.round(amount * 100),
        currency: "USD",
      })

      return NextResponse.json({
        approvalUrl, // Keep existing format for compatibility
        orderId: order.id,
        jobId: resultJobId,
      })
    }

    // Non-mock mode: create pending order and call PayPal API
    // TODO: Integrate with PayPal API
    // 1. Create PayPal order
    // 2. Get approval URL from PayPal
    // 3. Store order in database with status='pending'
    // 4. Return approval URL

    const order = await createOrderRecord({
      jobId: resultJobId,
      status: "pending",
      amountCents: Math.round(amount * 100),
      currency: "USD",
    })

    // For now, return mock response (will be replaced with real PayPal integration)
    return NextResponse.json({
      approvalUrl: `/results/${resultJobId}?paid=1`, // Temporary for development
      orderId: order.id,
      jobId: resultJobId,
    })
  } catch (error) {
    console.error("Error in payments/create API:", error)
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    )
  }
}

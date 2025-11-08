import { NextRequest, NextResponse } from "next/server"
import e2eStore from "@/lib/e2eStore"

/**
 * Dev-only test utility: Seed test data
 * POST /api/test/seed
 * Body: { makePaid?: boolean }
 * 
 * Creates a demo job and optionally a paid order for E2E testing.
 * Returns 404 in production.
 */
export async function POST(request: NextRequest) {
  // Guard: Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const makePaid = body?.makePaid === true

    const jobId = "e2e-job-001"

    // Always upsert the job 'e2e-job-001'
    e2eStore.jobs.set(jobId, {
      id: jobId,
      status: "succeeded",
      result_urls: ["/assets/mock/family1.jpg", "/assets/mock/family2.jpg"],
      user_id: "e2e-user",
    })

    // If makePaid=true, upsert an order with status='paid'
    if (makePaid) {
      const orderId = `order-${jobId}`
      e2eStore.orders.set(orderId, {
        id: orderId,
        job_id: jobId,
        status: "paid",
        provider: "paypal",
        provider_ref: "e2e-capture",
        user_id: "e2e-user",
      })
    } else {
      // Remove any existing paid order for this job
      for (const [orderId, order] of e2eStore.orders.entries()) {
        if (order.job_id === jobId) {
          e2eStore.orders.delete(orderId)
        }
      }
    }

    return NextResponse.json({
      jobId: "e2e-job-001",
      paid: !!makePaid,
    }, { status: 200 })
  } catch (error) {
    console.error("Error in test/seed API:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to seed test data" },
      { status: 500 }
    )
  }
}


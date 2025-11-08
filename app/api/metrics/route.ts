import { NextRequest, NextResponse } from "next/server"

interface MetricPayload {
  event: string
  jobId?: string
  orderId?: string
  metadata?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const body: MetricPayload = await request.json()

    if (!body.event) {
      return NextResponse.json(
        { error: "Event is required" },
        { status: 400 }
      )
    }

    // Log metric event (in production, you might send to analytics service)
    console.log("[METRIC]", {
      event: body.event,
      jobId: body.jobId,
      orderId: body.orderId,
      metadata: body.metadata,
      timestamp: new Date().toISOString(),
    })

    // TODO: In production, send to analytics service (e.g., PostHog, Mixpanel, etc.)
    // Example:
    // await analytics.track(body.event, {
    //   jobId: body.jobId,
    //   orderId: body.orderId,
    //   ...body.metadata,
    // })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error tracking metric:", error)
    // Return 200 to prevent metrics from breaking the app
    return NextResponse.json({ success: false }, { status: 200 })
  }
}


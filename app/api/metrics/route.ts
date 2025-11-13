import { NextRequest, NextResponse } from "next/server"
import { logAnalyticsEvent } from "@/lib/analytics/client"

interface MetricPayload {
  event: string
  request_id?: string
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

    // 记录到 analytics（Supabase + Logflare）
    await logAnalyticsEvent({
      event_type: body.event,
      request_id: body.request_id,
      job_id: body.jobId,
      order_id: body.orderId,
      data: body.metadata,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error tracking metric:", error)
    // Return 200 to prevent metrics from breaking the app
    return NextResponse.json({ success: false }, { status: 200 })
  }
}


/**
 * GET /api/analytics/trace?request_id=xxx
 * 
 * 通过 request_id 追踪事件
 */

import { NextRequest, NextResponse } from "next/server"
import { getEventsByRequestId } from "@/lib/analytics/metrics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const requestId = searchParams.get("request_id")

    if (!requestId) {
      return NextResponse.json(
        { error: "request_id is required" },
        { status: 400 }
      )
    }

    const events = await getEventsByRequestId(requestId)

    return NextResponse.json({
      success: true,
      request_id: requestId,
      events,
      count: events.length,
    })
  } catch (error: any) {
    console.error("Error tracing events:", error)
    return NextResponse.json(
      { error: "Failed to trace events", message: error.message },
      { status: 500 }
    )
  }
}




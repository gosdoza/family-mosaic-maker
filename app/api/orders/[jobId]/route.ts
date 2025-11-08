import { NextRequest, NextResponse } from "next/server"
import { getOrderByJob } from "@/lib/orders"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const jobId = resolvedParams.jobId

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    const order = await getOrderByJob(jobId)

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("Error in orders API:", error)
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    )
  }
}


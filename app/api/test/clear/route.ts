import { NextRequest, NextResponse } from "next/server"
import e2eStore from "@/lib/e2eStore"

/**
 * Dev-only test utility: Clear test data
 * POST /api/test/clear
 * 
 * Clears in-memory E2E store (jobs and orders).
 * Returns 404 in production.
 */
export async function POST(request: NextRequest) {
  // Guard: Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    // Clear in-memory store
    e2eStore.jobs.clear()
    e2eStore.orders.clear()

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("Error in test/clear API:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to clear test data" },
      { status: 500 }
    )
  }
}


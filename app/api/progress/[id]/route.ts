import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const jobId = resolvedParams.id

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Check if we're using mock mode
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

    if (useMock) {
      // Return mock progress data for testing
      return NextResponse.json({
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
      })
    }

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch job status from database
    const { data: job, error } = await supabase
      .from("jobs")
      .select("status, progress, error_message")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Map database status to API response
    const statusMap: Record<string, string> = {
      pending: "processing",
      processing: "processing",
      completed: "succeeded",
      failed: "failed",
    }

    const apiStatus = statusMap[job.status] || "processing"
    const progress = job.progress || (apiStatus === "succeeded" ? 100 : 50)

    return NextResponse.json({
      jobId,
      status: apiStatus,
      progress,
      message:
        apiStatus === "succeeded"
          ? "Generation complete!"
          : apiStatus === "failed"
            ? job.error_message || "Generation failed"
            : "Processing your images...",
    })
  } catch (error) {
    console.error("Error in progress API:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}

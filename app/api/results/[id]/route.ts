import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import e2eStore from "@/lib/e2eStore"

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
      // Check e2e store for job
      const job = e2eStore.jobs.get(jobId)
      if (!job) {
        // Fallback to mock results data for testing
        const mockImages = [
          { id: 0, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
          { id: 1, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
        ]

        // Check for paid order even if job doesn't exist in store
        const paid = [...e2eStore.orders.values()].some(
          (o) => o.job_id === jobId && o.status === "paid"
        )

        return NextResponse.json({
          jobId,
          images: mockImages,
          paymentStatus: paid ? "paid" : "unpaid",
          createdAt: new Date().toISOString(),
        })
      }

      // Check for paid order: 只要 e2eStore 中有該 job 的訂單且為 paid，就判定已付
      const paid = [...e2eStore.orders.values()].some(
        (o) => o.job_id === jobId && o.status === "paid"
      )

      // Debug log in development
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Results API] Job ${jobId}: paymentStatus=${paid ? "paid" : "unpaid"}, orders=${e2eStore.orders.size}`)
      }

      return NextResponse.json({
        jobId,
        images: (job.result_urls || []).map((url, idx) => ({
          id: idx,
          url,
          thumbnail: url,
        })),
        paymentStatus: paid ? "paid" : "unpaid",
        createdAt: job.created_at ?? new Date().toISOString(),
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

    // Fetch job and results from database
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, created_at, order_id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Fetch images for this job
    const { data: images, error: imagesError } = await supabase
      .from("job_images")
      .select("id, url, thumbnail_url")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    if (imagesError) {
      console.error("Error fetching images:", imagesError)
    }

    // Fetch payment status from order if exists
    let paymentStatus = "unpaid"
    if (job.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", job.order_id)
        .single()

      if (order) {
        paymentStatus = order.payment_status || "unpaid"
      }
    }

    // Format images to match API structure: { url }
    const formattedImages = (images || []).map((img) => ({
      id: img.id,
      url: img.url,
      thumbnail: img.thumbnail_url || img.url,
    }))

    return NextResponse.json({
      jobId,
      images: formattedImages,
      paymentStatus,
      createdAt: job.created_at || new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in results API:", error)
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    )
  }
}

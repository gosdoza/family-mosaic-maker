import { NextRequest, NextResponse } from "next/server"
import { getOrderByJob } from "@/lib/orders"
import { createClient } from "@/lib/supabase/server"
import e2eStore from "@/lib/e2eStore"
import { isDemoMode, isPreviewEnv, isDemoJob } from "@/lib/featureFlags"

export async function GET(request: NextRequest) {
  // Phase 1: Temporary console logging for debugging
  console.log("[api/orders] GET request", {
    url: request.url,
    method: request.method,
  })

  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get("jobId")

    // Phase 2: Early guard for demo/mock mode - detect preview or mock
    // NOTE: behavior preserved, just using centralized feature flags
    // TEMP (Route D mock): Be generous in preview to avoid 500s
    // TODO: tighten this when we wire real DB + PayPal
    const isDemo = isDemoMode || isPreviewEnv

    console.log("[api/orders] mode check", {
      isDemo,
      isDemoMode,
      isPreviewEnv,
      jobId,
    })

    // Phase 2: Early return for demo mode - never touch Supabase/DB
    if (isDemo) {
      console.log("[api/orders] returning mock orders (demo mode)")
      
      // If jobId is provided, return single order by jobId (for results page)
      if (jobId) {
        // For demo-001, return a mock order
        // NOTE: behavior preserved, just using centralized feature flags
        if (isDemoJob(jobId)) {
          return NextResponse.json({
            order: {
              id: "ord_demo_001",
              job_id: "demo-001",
              status: "paid",
              paypal_capture_id: "mock-capture",
              paypal_order_id: "mock-order",
            },
          })
        }
        // Other jobIds return null in demo
        return NextResponse.json({ order: null })
      }

      // Return mock orders list for demo
      const mockOrders = [
        {
          id: "ord_demo_001",
          jobId: "demo-001",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          paymentStatus: "paid",
          createdAt: new Date().toISOString(),
          date: new Date().toISOString().split("T")[0],
          template: "Christmas",
          thumbnail: "/assets/mock/family1.jpg",
          count: 2,
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
        },
        {
          id: "ord_demo_002",
          jobId: "demo-002",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          paymentStatus: "paid",
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          template: "Birthday",
          thumbnail: "/assets/mock/family2.jpg",
          count: 2,
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
        },
        {
          id: "ord_demo_003",
          jobId: "demo-003",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          paymentStatus: "paid",
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
          template: "Wedding",
          thumbnail: "/assets/mock/family1.jpg",
          count: 2,
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
        },
      ]

      return NextResponse.json({ orders: mockOrders })
    }

    // Check if we're using mock mode (legacy check, kept for backward compatibility)
    // NOTE: behavior preserved, just using centralized feature flags
    const useMock = isDemoMode

    // If jobId is provided, return single order by jobId (for results page)
    if (jobId) {
      if (useMock && e2eStore.orders.size > 0) {
        // Check e2e store for order
        for (const order of e2eStore.orders.values()) {
          if (order.job_id === jobId) {
            return NextResponse.json({
              order: {
                id: order.id,
                job_id: order.job_id,
                status: order.status,
                paypal_capture_id: order.provider_ref,
                paypal_order_id: order.provider_ref,
              },
            })
          }
        }
        // No order found in e2e store
        return NextResponse.json({ order: null })
      }

      const order = await getOrderByJob(jobId)
      return NextResponse.json({ order })
    }

    // Otherwise, return all orders for current user (for orders page)
    if (useMock && e2eStore.orders.size > 0) {
      // Return orders from e2e store
      const orders = Array.from(e2eStore.orders.values())
        .filter((order) => order.user_id === "e2e-user")
        .map((order) => {
          const job = e2eStore.jobs.get(order.job_id)
          return {
            id: order.id,
            date: new Date().toISOString().split("T")[0],
            status: job?.status === "succeeded" ? "Completed" : "Processing",
            thumbnail: job?.result_urls[0] || "/placeholder.svg",
            count: job?.result_urls.length || 0,
            template: "Christmas",
            jobId: order.job_id,
            paymentStatus: order.status === "paid" ? "paid" : "unpaid",
            images: (job?.result_urls || []).map((url, idx) => ({
              id: idx + 1,
              url,
              thumbnail: url,
            })),
          }
        })

      return NextResponse.json({ orders })
    }

    if (useMock) {
      // Route D: Return mock orders for testing (fallback)
      // 確保包含 demo-001 的訂單（用於 QA 測試），狀態為 paid
      // TODO: Replace mock /api/orders with real DB-backed orders when we integrate Stripe/PayPal fully.
      const mockOrders = [
        {
          id: "ord_demo_001",
          jobId: "demo-001",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          createdAt: new Date().toISOString(),
          date: new Date().toISOString().split("T")[0],
          thumbnail: "/assets/mock/family1.jpg",
          count: 2,
          template: "Christmas",
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
          paymentStatus: "paid", // demo-001 訂單標記為已付費（用於 Route C mock checkout）
        },
        {
          id: "ord_demo_002",
          jobId: "demo-002",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
          thumbnail: "/assets/mock/family2.jpg",
          count: 2,
          template: "Birthday",
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
          paymentStatus: "paid",
        },
        {
          id: "ord_demo_003",
          jobId: "demo-003",
          status: "Completed",
          amount: 2.99,
          currency: "USD",
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
          thumbnail: "/assets/mock/family1.jpg",
          count: 2,
          template: "Wedding",
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
          paymentStatus: "paid",
        },
      ]
      return NextResponse.json({ orders: mockOrders })
    }

    // Phase 2: Non-demo path - wrap in try/catch to prevent 500s
    // Route D: In mock mode, allow access without auth (for demo-001)
    // TODO: Remove this exception when real orders integration is ready
    try {
      // Get current user (optional in mock mode)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

      // Only require auth in non-mock mode
      if (!useMock && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch orders from database
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        created_at,
        payment_status,
        status,
        job_id,
        jobs (
          id,
          template,
          style,
          status,
          job_images (
            id,
            url,
            thumbnail_url
          )
        )
      `
      )
        .eq("user_id", user?.id || "")
      .order("created_at", { ascending: false })

    if (error) {
        console.error("[api/orders] error fetching from DB:", error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    // Format orders to match frontend structure
    const formattedOrders = (orders || []).map((order: any) => {
      const job = order.jobs?.[0] || {}
      const images = job.job_images || []

      return {
        id: order.id,
        date: new Date(order.created_at).toISOString().split("T")[0],
        status: job.status || order.status || "Completed",
        thumbnail: images[0]?.thumbnail_url || images[0]?.url || "/placeholder.svg",
        count: images.length,
        template: job.template || "Unknown",
        style: job.style || undefined,
        jobId: order.job_id || job.id,
        images: images.map((img: any) => ({
          id: img.id,
          url: img.url,
          thumbnail: img.thumbnail_url || img.url,
        })),
        paymentStatus: order.status === "paid" ? "paid" : (order.payment_status || "unpaid"),
      }
    })

    return NextResponse.json({ orders: formattedOrders })
    } catch (dbError: any) {
      // Phase 2: Controlled error handling - log but return controlled 500
      console.error("[api/orders] error", dbError)
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      )
    }
  } catch (error: any) {
    // Phase 2: Top-level catch - should not be hit in demo mode, but safety net
    console.error("[api/orders] top-level error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

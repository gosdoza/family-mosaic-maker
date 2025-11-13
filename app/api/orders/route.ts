import { NextRequest, NextResponse } from "next/server"
import { getOrderByJob } from "@/lib/orders"
import { createClient } from "@/lib/supabase/server"
import e2eStore from "@/lib/e2eStore"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get("jobId")

    // Check if we're using mock mode
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

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
      // Return mock orders for testing (fallback)
      // 確保包含 demo-001 的訂單（用於 QA 測試），狀態為 paid
      const mockOrders = [
        {
          id: "ORD-001",
          date: new Date().toISOString().split("T")[0],
          status: "Completed",
          thumbnail: "/assets/mock/family1.jpg",
          count: 3,
          template: "Christmas",
          jobId: "demo-001",
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
            { id: 3, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
          ],
          paymentStatus: "paid", // demo-001 訂單標記為已付費（用於 QA 測試）
        },
        {
          id: "ORD-002",
          date: "2025-01-10",
          status: "Completed",
          thumbnail: "/assets/mock/family2.jpg",
          count: 2,
          template: "Birthday",
          images: [
            { id: 1, url: "/assets/mock/family1.jpg", thumbnail: "/assets/mock/family1.jpg" },
            { id: 2, url: "/assets/mock/family2.jpg", thumbnail: "/assets/mock/family2.jpg" },
          ],
          paymentStatus: "paid",
        },
      ]
      return NextResponse.json({ orders: mockOrders })
    }

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
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
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching orders:", error)
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
  } catch (error) {
    console.error("Error in orders API:", error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

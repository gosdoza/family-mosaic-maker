import { NextRequest, NextResponse } from "next/server"
import e2eStore from "@/lib/e2eStore"
import { createClient } from "@/lib/supabase/server"
import { getOrderByJob } from "@/lib/orders"

// Check if we're using mock mode
const IS_MOCK = process.env.USE_MOCK === "true" || process.env.NEXT_PUBLIC_USE_MOCK === "true"

/**
 * GET /api/download
 * Query params: job=<id>&i=<index>
 * 
 * Returns a 302 redirect to a signed URL for downloading HD images.
 * In mock mode, returns a mock signed URL.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get("job")
    const imageIndex = searchParams.get("i")

    if (!jobId || !imageIndex) {
      return NextResponse.json(
        { error: "Job ID and image index are required" },
        { status: 400 }
      )
    }

    const index = parseInt(imageIndex, 10)
    if (isNaN(index) || index < 0) {
      return NextResponse.json(
        { error: "Invalid image index" },
        { status: 400 }
      )
    }

    // Verify user session (or __e2e cookie in dev)
    const e2eCookie = request.cookies.get("__e2e")
    const isE2EAuth = e2eCookie?.value === "1" || e2eCookie?.value === "true"

    if (IS_MOCK) {
      // In mock mode, allow if e2e cookie is present
      if (!isE2EAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else {
      // In non-mock mode, verify Supabase session
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Check a PAID order exists for job
    let hasPaidOrder = false

    if (IS_MOCK) {
      // Check e2e store
      for (const order of e2eStore.orders.values()) {
        if (order.job_id === jobId && order.status === "paid") {
          hasPaidOrder = true
          break
        }
      }
    } else {
      // Check database for paid order
      const order = await getOrderByJob(jobId)
      hasPaidOrder = order?.status === "paid"
    }

    if (!hasPaidOrder) {
      return NextResponse.json(
        { error: "Order is not paid" },
        { status: 403 }
      )
    }

    // Lookup jobs.result_urls[i]
    let imagePath: string | null = null

    if (IS_MOCK) {
      // Check e2e store for job
      const job = e2eStore.jobs.get(jobId)
      if (job && job.result_urls[index]) {
        imagePath = job.result_urls[index]
      } else {
        // Fallback to mock images: /assets/mock/family${i+1}.jpg
        imagePath = `/assets/mock/family${index + 1}.jpg`
      }
    } else {
      // Fetch from database
      const supabase = await createClient()
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("result_urls")
        .eq("id", jobId)
        .single()

      if (jobError || !job) {
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        )
      }

      // Get result_urls array (stored as text[] or JSON)
      const resultUrls = Array.isArray(job.result_urls)
        ? job.result_urls
        : typeof job.result_urls === "string"
        ? JSON.parse(job.result_urls)
        : []

      if (!resultUrls[index]) {
        return NextResponse.json(
          { error: "Image not found at specified index" },
          { status: 404 }
        )
      }

      imagePath = resultUrls[index]
    }

    if (!imagePath) {
      return NextResponse.json(
        { error: "Image not found at specified index" },
        { status: 404 }
      )
    }

    // Generate signed URL based on mode
    if (IS_MOCK) {
      // MOCK → 302 to /assets/mock/family${i+1}.jpg?mockSigned=1
      const baseUrl = request.nextUrl.origin
      const mockSignedUrl = imagePath.startsWith("http")
        ? `${imagePath}?mockSigned=1&exp=${Date.now() + 10 * 60 * 1000}`
        : `${baseUrl}${imagePath}?mockSigned=1&exp=${Date.now() + 10 * 60 * 1000}`
      return NextResponse.redirect(mockSignedUrl, { status: 302 })
    } else {
      // REAL → 302 to Supabase signed URL (expires 15m)
      const supabase = await createClient()

      // Parse storage path from imagePath
      // Format: "bucket-name/path/to/file.jpg" or "https://...supabase.co/storage/v1/object/public/bucket/path"
      let bucket: string
      let filePath: string

      if (imagePath.startsWith("http")) {
        // Extract bucket and path from public URL
        const urlMatch = imagePath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
        if (urlMatch) {
          bucket = urlMatch[1]
          filePath = urlMatch[2]
        } else {
          // Fallback: try to extract from path
          const pathParts = imagePath.split("/")
          bucket = pathParts[pathParts.length - 2] || "results"
          filePath = pathParts[pathParts.length - 1] || imagePath
        }
      } else {
        // Assume format: "bucket/path/to/file.jpg" or just "path/to/file.jpg"
        const pathParts = imagePath.split("/")
        if (pathParts.length > 1 && !imagePath.includes(".")) {
          // Likely has bucket prefix
          bucket = pathParts[0]
          filePath = pathParts.slice(1).join("/")
        } else {
          // Default bucket
          bucket = "results"
          filePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath
        }
      }

      // Generate signed URL (expires in 15 minutes)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 15 * 60) // 15 minutes

      if (signedUrlError || !signedUrlData) {
        console.error("Error generating signed URL:", signedUrlError)
        return NextResponse.json(
          { error: "Failed to generate download URL" },
          { status: 500 }
        )
      }

      return NextResponse.redirect(signedUrlData.signedUrl, { status: 302 })
    }
  } catch (error) {
    console.error("Error in download API:", error)
    return NextResponse.json(
      { error: "Failed to process download request" },
      { status: 500 }
    )
  }
}

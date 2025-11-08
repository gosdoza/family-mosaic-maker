import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Check if we're using mock mode
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

    if (useMock) {
      // Return a mock job ID for testing (skip validation in mock mode)
      return NextResponse.json({ jobId: "demo-001" })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const style = formData.get("style") as string
    const template = formData.get("template") as string

    // Validate inputs (only in non-mock mode)
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    if (!style) {
      return NextResponse.json({ error: "No style selected" }, { status: 400 })
    }

    if (!template) {
      return NextResponse.json({ error: "No template selected" }, { status: 400 })
    }

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // TODO: Integrate with Runware API or your inference service
    // Example structure:
    // const runwareResponse = await fetch('https://api.runware.com/v1/generate', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     files: files.map(f => f.name),
    //     style,
    //     template,
    //   }),
    // })
    // const { jobId } = await runwareResponse.json()

    // For now, generate a unique job ID and store in database
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Store job in database
    const { error: dbError } = await supabase.from("jobs").insert({
      id: jobId,
      user_id: user.id,
      style,
      template,
      status: "pending",
      created_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error("Error storing job:", dbError)
      // Continue anyway, job might still be processed
    }

    // TODO: Trigger actual inference service here
    // await triggerInferenceService(jobId, files, style, template)

    return NextResponse.json({ jobId })
  } catch (error) {
    console.error("Error in generate API:", error)
    return NextResponse.json(
      { error: "Failed to process generation request" },
      { status: 500 }
    )
  }
}

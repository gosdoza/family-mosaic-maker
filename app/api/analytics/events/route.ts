import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/analytics/events
 * 
 * 获取当前用户最近的事件记录（仅显示最近 10 笔）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 2. 查询最近 10 笔事件
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await serviceClient
      .from("analytics_logs")
      .select("event_type, event_data, created_at")
      .eq("user_id", user.id)
      .in("event_type", ["upload_start", "upload_ok", "upload_rate_limited", "preview_view"])
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Failed to fetch events:", error)
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      )
    }

    // 3. 格式化事件数据（不包含敏感字段）
    const events = (data || []).map((event) => ({
      event_type: event.event_type,
      request_id: event.event_data?.request_id || null,
      created_at: event.created_at,
      // 不包含敏感字段（如 file_path, signed_url 等）
      summary: getEventSummary(event.event_type, event.event_data),
    }))

    return NextResponse.json({
      success: true,
      events,
    })
  } catch (error: any) {
    console.error("Analytics events error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * 获取事件摘要（不包含敏感字段）
 */
function getEventSummary(eventType: string, eventData: any): string {
  switch (eventType) {
    case "upload_start":
      return `Started upload (${eventData?.file_count || 0} files)`
    case "upload_ok":
      return `Upload successful (${eventData?.file_count || 0} files)`
    case "upload_rate_limited":
      return `Rate limited: ${eventData?.error || "unknown"}`
    case "preview_view":
      return `Preview generated (${eventData?.preview_size || 1024}px)`
    default:
      return "Event recorded"
  }
}




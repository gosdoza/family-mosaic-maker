/**
 * POST /api/gdpr/request
 * 
 * 创建 GDPR 删除申请
 * 
 * 请求体：
 * {
 *   "reason": "test" // 可选
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
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

    // 2. 解析请求体
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || "User requested data deletion"

    // 3. 检查是否已有待处理的删除申请
    const { data: existingRequest, error: checkError } = await supabase
      .from("gdpr_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("request_type", "delete")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking existing request:", checkError)
    }

    if (existingRequest) {
      return NextResponse.json(
        {
          error: "A deletion request is already in progress",
          request_id: existingRequest.id,
          status: existingRequest.status,
        },
        { status: 409 }
      )
    }

    // 4. 创建删除申请
    const { data: gdprRequest, error: insertError } = await supabase
      .from("gdpr_requests")
      .insert({
        user_id: user.id,
        request_type: "delete",
        status: "pending",
        request_data: {
          reason,
          requested_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating GDPR request:", insertError)
      return NextResponse.json(
        { error: "Failed to create GDPR request", message: insertError.message },
        { status: 500 }
      )
    }

    // 5. 记录 analytics 事件
    try {
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

      await serviceClient.from("analytics_logs").insert({
        event_type: "gdpr_delete_request",
        event_data: {
          request_id: gdprRequest.id,
          user_id: user.id,
          reason,
        },
        user_id: user.id,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      // 静默失败，不影响主流程
      console.warn("Failed to log GDPR request event:", error)
    }

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      request_id: gdprRequest.id,
      status: gdprRequest.status,
      message: "GDPR deletion request created successfully. Your data will be deleted within 72 hours.",
      estimated_completion: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 小时后
    })
  } catch (error: any) {
    console.error("Error in GDPR request API:", error)
    return NextResponse.json(
      { error: "Failed to process GDPR request", message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/request
 * 
 * 查询当前用户的 GDPR 请求状态
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

    // 2. 查询用户的 GDPR 请求
    const { data: requests, error: queryError } = await supabase
      .from("gdpr_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("request_type", "delete")
      .order("created_at", { ascending: false })
      .limit(10)

    if (queryError) {
      console.error("Error querying GDPR requests:", queryError)
      return NextResponse.json(
        { error: "Failed to query GDPR requests", message: queryError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
      count: requests?.length || 0,
    })
  } catch (error: any) {
    console.error("Error in GDPR request GET API:", error)
    return NextResponse.json(
      { error: "Failed to query GDPR requests", message: error.message },
      { status: 500 }
    )
  }
}




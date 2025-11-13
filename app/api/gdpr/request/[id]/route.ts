/**
 * GET /api/gdpr/request/[id]
 * 
 * 查询特定 GDPR 请求的状态
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // 2. 获取请求 ID
    const resolvedParams = await Promise.resolve(params)
    const requestId = resolvedParams.id

    // 3. 查询 GDPR 请求
    const { data: gdprRequest, error: queryError } = await supabase
      .from("gdpr_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", user.id) // 确保只能查询自己的请求
      .single()

    if (queryError || !gdprRequest) {
      return NextResponse.json(
        { error: "GDPR request not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      request: gdprRequest,
    })
  } catch (error: any) {
    console.error("Error in GDPR request GET API:", error)
    return NextResponse.json(
      { error: "Failed to query GDPR request", message: error.message },
      { status: 500 }
    )
  }
}




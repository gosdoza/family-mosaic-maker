/**
 * POST /api/gdpr/process
 * 
 * 处理待处理的 GDPR 删除请求
 * 
 * 此端点应该由定时任务调用（每 6 小时一次）
 * 处理所有超过 72 小时的待处理请求
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { executeGDPRDeletion } from "@/lib/gdpr/deletion"

export const dynamic = "force-dynamic"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * 发送结果通知给用户
 */
async function notifyUser(
  userId: string,
  requestId: string,
  success: boolean,
  details: any
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 获取用户邮箱
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !userData?.user?.email) {
      console.warn("Cannot get user email for notification:", userError)
      return
    }

    // 更新 GDPR 请求的 response_data
    await supabase
      .from("gdpr_requests")
      .update({
        response_data: {
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
          email: userData.user.email,
          details,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)

    // 这里可以发送邮件通知
    // 目前只记录到 response_data
    console.log(`GDPR deletion ${success ? "completed" : "failed"} for user ${userId}`)
  } catch (error) {
    console.error("Error notifying user:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证服务端调用（可选：添加 API Key 验证）
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.GDPR_PROCESS_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. 查询所有待处理的删除请求（超过 72 小时）
    const cutoffTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    const { data: pendingRequests, error: queryError } = await supabase
      .from("gdpr_requests")
      .select("*")
      .eq("request_type", "delete")
      .eq("status", "pending")
      .lte("created_at", cutoffTime)

    if (queryError) {
      console.error("Error querying pending requests:", queryError)
      return NextResponse.json(
        { error: "Failed to query pending requests", message: queryError.message },
        { status: 500 }
      )
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending requests to process",
        processed: 0,
      })
    }

    // 2. 处理每个请求
    const results = []
    for (const gdprRequest of pendingRequests) {
      try {
        // 更新状态为 processing
        await supabase
          .from("gdpr_requests")
          .update({
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", gdprRequest.id)

        // 执行删除
        const deletionResult = await executeGDPRDeletion(gdprRequest.user_id, gdprRequest.id)

        // 更新状态和结果
        const completedAt = new Date().toISOString()
        await supabase
          .from("gdpr_requests")
          .update({
            status: deletionResult.success ? "completed" : "failed",
            response_data: {
              storage: deletionResult.storage,
              database: deletionResult.database,
              error: deletionResult.error,
              completed_at: completedAt,
            },
            completed_at: completedAt,
            updated_at: completedAt,
          })
          .eq("id", gdprRequest.id)

        // 通知用户
        await notifyUser(
          gdprRequest.user_id,
          gdprRequest.id,
          deletionResult.success,
          {
            storage: deletionResult.storage,
            database: deletionResult.database,
          }
        )

        results.push({
          request_id: gdprRequest.id,
          user_id: gdprRequest.user_id,
          success: deletionResult.success,
        })
      } catch (error: any) {
        console.error(`Error processing request ${gdprRequest.id}:`, error)

        // 更新状态为 failed
        await supabase
          .from("gdpr_requests")
          .update({
            status: "failed",
            response_data: {
              error: error.message,
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", gdprRequest.id)

        results.push({
          request_id: gdprRequest.id,
          user_id: gdprRequest.user_id,
          success: false,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error("Error in GDPR process API:", error)
    return NextResponse.json(
      { error: "Failed to process GDPR requests", message: error.message },
      { status: 500 }
    )
  }
}




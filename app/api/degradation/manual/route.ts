/**
 * POST /api/degradation/manual
 * 
 * 手动触发降级或回滚
 * 
 * 请求体：
 * {
 *   "action": "degrade" | "rollback",
 *   "reason": "Manual degradation reason"
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { setDegradationStatus } from "@/lib/degradation/manager"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 验证服务端调用（可选：添加 API Key 验证）
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.DEGRADATION_MANUAL_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { action, reason } = body

    if (!action || !reason) {
      return NextResponse.json(
        { error: "action and reason are required" },
        { status: 400 }
      )
    }

    if (action !== "degrade" && action !== "rollback") {
      return NextResponse.json(
        { error: "action must be 'degrade' or 'rollback'" },
        { status: 400 }
      )
    }

    // 设置降级状态
    const result = await setDegradationStatus(
      action === "degrade",
      reason,
      "manual"
    )

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to set degradation status", message: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      action,
      isDegraded: action === "degrade",
      reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in manual degradation API:", error)
    return NextResponse.json(
      { error: "Failed to process manual degradation", message: error.message },
      { status: 500 }
    )
  }
}




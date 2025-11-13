/**
 * POST /api/degradation/detect
 * 
 * 自动检测降级条件并触发降级
 * 
 * 此端点应该由定时任务调用（每 5 分钟一次）
 */

import { NextRequest, NextResponse } from "next/server"
import { autoDetectAndDegrade } from "@/lib/degradation/manager"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 验证服务端调用（可选：添加 API Key 验证）
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.DEGRADATION_DETECT_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 自动检测并处理降级
    const result = await autoDetectAndDegrade()

    return NextResponse.json({
      success: true,
      degraded: result.degraded,
      reason: result.reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in degradation detect API:", error)
    return NextResponse.json(
      { error: "Failed to detect degradation", message: error.message },
      { status: 500 }
    )
  }
}




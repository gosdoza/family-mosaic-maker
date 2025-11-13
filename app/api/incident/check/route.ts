/**
 * POST /api/incident/check
 * 
 * 檢查是否連續 30 分鐘超閾值（失敗率>2% 或 p95>8s）
 * 如果超閾值，發送 Slack 通知
 */

import { NextRequest, NextResponse } from "next/server"
import { checkIncidentThresholds, sendSlackAlert } from "@/lib/incident/slack"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 驗證請求者是否有權限（例如：檢查 service role key）
    const authHeader = request.headers.get("Authorization")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 檢查是否超閾值
    const alert = await checkIncidentThresholds()

    if (!alert) {
      return NextResponse.json({
        success: true,
        alert: null,
        message: "No incident detected",
      })
    }

    // 發送 Slack 通知
    const sent = await sendSlackAlert(alert)

    return NextResponse.json({
      success: true,
      alert,
      slack_sent: sent,
      message: sent ? "Alert sent to Slack" : "Failed to send alert to Slack",
    })
  } catch (error: any) {
    console.error("Error checking incident thresholds:", error)
    return NextResponse.json(
      { error: "Failed to check incident thresholds", message: error.message },
      { status: 500 }
    )
  }
}




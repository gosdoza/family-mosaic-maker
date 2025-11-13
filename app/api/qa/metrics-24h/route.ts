/**
 * GET /api/qa/metrics-24h
 * 
 * 获取最后 24 小时的核心指标
 * 用于 Final Gate QA 封板报告
 */

import { NextRequest, NextResponse } from "next/server"
import { calculateMetrics24H } from "@/lib/analytics/metrics-24h"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const metrics = await calculateMetrics24H()

    return NextResponse.json({
      success: true,
      metrics,
      thresholds: {
        p95_latency_ms: 8000, // 8 秒
        failure_rate_percent: 2.0, // 2%
        refund_rate_percent: 5.0, // 5%
        gdpr_completion_rate_percent: 100, // 100%
      },
      status: {
        p95_latency: metrics.p95_latency_ms !== null && metrics.p95_latency_ms < 8000 ? "PASS" : "FAIL",
        failure_rate: metrics.failure_rate_percent !== null && metrics.failure_rate_percent <= 2.0 ? "PASS" : "FAIL",
        refund_rate: metrics.refund_rate_percent !== null && metrics.refund_rate_percent < 5.0 ? "PASS" : "FAIL",
        gdpr_completion: metrics.gdpr_completion_rate_percent !== null && metrics.gdpr_completion_rate_percent === 100 ? "PASS" : "FAIL",
      },
    })
  } catch (error: any) {
    console.error("Error calculating 24h metrics:", error)
    return NextResponse.json(
      { error: "Failed to calculate metrics", message: error.message },
      { status: 500 }
    )
  }
}




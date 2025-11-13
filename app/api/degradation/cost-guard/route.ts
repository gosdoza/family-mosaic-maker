/**
 * Cost Guard API
 * 
 * POST /api/degradation/cost-guard
 * 
 * 成本監控和自動降級檢測
 * - 檢查最近 30 分鐘的失敗率、p95 延遲、單張成本
 * - 如果超標，執行降級動作並記錄 auto_downgrade 事件
 */

import { NextRequest, NextResponse } from "next/server"
import { checkAndDowngrade } from "@/lib/degradation/cost-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/degradation/cost-guard
 * 
 * 檢查成本監控紅線並執行降級動作
 */
export async function POST(request: NextRequest) {
  try {
    const result = await checkAndDowngrade()

    return NextResponse.json(
      {
        ok: true,
        triggered: result.triggered,
        reasons: result.reasons,
        metrics: result.metrics,
        actions: result.actions,
        timestamp: result.timestamp,
      },
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in cost guard API:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to check cost guard",
      },
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }
    )
  }
}

/**
 * GET /api/degradation/cost-guard
 * 
 * 查詢當前成本監控狀態（不執行降級）
 */
export async function GET(request: NextRequest) {
  try {
    // 只檢查指標，不執行降級
    const { calculateMetrics30Min } = await import("@/lib/degradation/cost-guard")
    const metrics = await calculateMetrics30Min()

    return NextResponse.json(
      {
        ok: true,
        metrics,
        thresholds: {
          failure_rate_percent: 2.0,
          p95_latency_ms: 8000,
          cost_per_image: 0.30,
        },
        window_minutes: 30,
      },
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in cost guard GET API:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to get cost guard status",
      },
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }
    )
  }
}


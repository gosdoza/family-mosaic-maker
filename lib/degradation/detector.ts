/**
 * Degradation Detector
 * 
 * 自动检测系统降级条件：
 * - 30 分钟内失败率 > 2%
 * - p95 延迟 > 8s
 * 
 * 当检测到降级条件时，自动更新 feature_flags 并记录到 Runbook
 */

import { createClient } from "@supabase/supabase-js"
import { calculateMetrics } from "@/lib/analytics/metrics"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 降级阈值
const FAILURE_RATE_THRESHOLD = 2.0 // 2%
const P95_LATENCY_THRESHOLD = 8000 // 8 seconds (8000ms)
const DETECTION_WINDOW_MINUTES = 30 // 30 分钟

export interface DegradationStatus {
  isDegraded: boolean
  reason: string | null
  metrics: {
    failure_rate_percent: number | null
    p95_latency_ms: number | null
  }
  detectedAt: string | null
}

/**
 * 检测系统是否降级
 */
export async function detectDegradation(): Promise<DegradationStatus> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      isDegraded: false,
      reason: null,
      metrics: {
        failure_rate_percent: null,
        p95_latency_ms: null,
      },
      detectedAt: null,
    }
  }

  try {
    // 1. 计算指标（使用 30 分钟窗口）
    const metrics = await calculateMetricsWithWindow(DETECTION_WINDOW_MINUTES)

    // 2. 检查降级条件
    const reasons: string[] = []

    if (metrics.failure_rate_percent !== null && metrics.failure_rate_percent > FAILURE_RATE_THRESHOLD) {
      reasons.push(`Failure rate ${metrics.failure_rate_percent.toFixed(2)}% exceeds threshold ${FAILURE_RATE_THRESHOLD}%`)
    }

    if (metrics.p95_latency_ms !== null && metrics.p95_latency_ms > P95_LATENCY_THRESHOLD) {
      reasons.push(`P95 latency ${metrics.p95_latency_ms}ms exceeds threshold ${P95_LATENCY_THRESHOLD}ms`)
    }

    const isDegraded = reasons.length > 0

    return {
      isDegraded,
      reason: isDegraded ? reasons.join("; ") : null,
      metrics: {
        failure_rate_percent: metrics.failure_rate_percent,
        p95_latency_ms: metrics.p95_latency_ms,
      },
      detectedAt: isDegraded ? new Date().toISOString() : null,
    }
  } catch (error: any) {
    console.error("Error detecting degradation:", error)
    return {
      isDegraded: false,
      reason: `Error: ${error.message}`,
      metrics: {
        failure_rate_percent: null,
        p95_latency_ms: null,
      },
      detectedAt: null,
    }
  }
}

/**
 * 使用自定义窗口计算指标
 */
async function calculateMetricsWithWindow(windowMinutes: number): Promise<{
  failure_rate_percent: number | null
  p95_latency_ms: number | null
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      failure_rate_percent: null,
      p95_latency_ms: null,
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  // 计算失败率
  const { data: startEvents } = await supabase
    .from("analytics_logs")
    .select("event_type, event_data")
    .gte("created_at", cutoffTime)
    .in("event_type", [
      "generate_start",
      "checkout_init",
      "payment_started",
      "download_started",
    ])

  const { data: failEvents } = await supabase
    .from("analytics_logs")
    .select("event_type, event_data")
    .gte("created_at", cutoffTime)
    .in("event_type", [
      "generate_fail",
      "checkout_fail",
      "payment_failed",
      "download_failed",
    ])

  const totalStarts = startEvents?.length || 0
  const actualFails = (failEvents || []).filter((event) => {
    const eventData = event.event_data as any
    return eventData?.error != null
  }).length

  const failure_rate_percent = totalStarts > 0 ? (actualFails / totalStarts) * 100 : null

  // 计算 p95 延迟
  const { data: allEvents } = await supabase
    .from("analytics_logs")
    .select("event_data")
    .gte("created_at", cutoffTime)

  const durations = (allEvents || [])
    .map((row) => {
      const eventData = row.event_data as any
      return eventData?.duration_ms
    })
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b)

  const p95_latency_ms = durations.length > 0
    ? durations[Math.floor(durations.length * 0.95)] || null
    : null

  return {
    failure_rate_percent,
    p95_latency_ms,
  }
}




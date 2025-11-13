/**
 * 24-Hour Metrics Calculator
 * 
 * 计算最后 24 小时的核心指标：
 * - p95 延迟（过去 24 小时）
 * - 失败率（过去 24 小时）
 * - 退款率（过去 24 小时）
 * - GDPR 任务完成率（过去 24 小时）
 * 
 * 用于 Final Gate QA 封板报告
 */

import { createClient } from "@supabase/supabase-js"

export interface Metrics24H {
  p95_latency_ms: number | null
  failure_rate_percent: number | null
  refund_rate_percent: number | null
  gdpr_completion_rate_percent: number | null
  last_updated: string
  period_hours: number
}

const WINDOW_HOURS = 24 // 24 小时窗口

/**
 * 计算 p95 延迟（过去 24 小时）
 */
async function calculateP95Latency24H(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // 查询过去 24 小时的所有事件，包含 duration_ms
    const { data, error } = await supabase
      .from("analytics_logs")
      .select("event_data")
      .gte("created_at", cutoffTime)

    if (error || !data || data.length === 0) {
      return null
    }

    // 提取所有 duration_ms 值
    const durations = (data || [])
      .map((row) => {
        const eventData = row.event_data as any
        return eventData?.duration_ms
      })
      .filter((d): d is number => typeof d === "number" && d > 0)
      .sort((a, b) => a - b)

    if (durations.length === 0) {
      return null
    }

    // 计算 p95（第 95 百分位）
    const p95Index = Math.floor(durations.length * 0.95)
    return durations[p95Index] || null
  } catch (error) {
    console.error("Failed to calculate p95 latency (24h):", error)
    return null
  }
}

/**
 * 计算失败率（过去 24 小时）
 */
async function calculateFailureRate24H(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // 查询所有开始事件
    const { data: startEvents, error: startError } = await supabase
      .from("analytics_logs")
      .select("event_type, event_data")
      .gte("created_at", cutoffTime)
      .in("event_type", [
        "generate_start",
        "checkout_init",
        "payment_started",
        "download_started",
      ])

    if (startError) {
      console.error("Failed to query start events (24h):", startError)
      return null
    }

    // 查询所有失败事件
    const { data: failEvents, error: failError } = await supabase
      .from("analytics_logs")
      .select("event_type, event_data")
      .gte("created_at", cutoffTime)
      .in("event_type", [
        "generate_fail",
        "checkout_fail",
        "payment_failed",
        "download_failed",
      ])

    if (failError) {
      console.error("Failed to query fail events (24h):", failError)
      return null
    }

    // 过滤出真正有错误的事件
    const actualFails = (failEvents || []).filter((event) => {
      const eventData = event.event_data as any
      return eventData?.error != null
    })

    const totalStarts = startEvents?.length || 0
    const totalFails = actualFails.length

    if (totalStarts === 0) {
      return null
    }

    // 计算失败率（百分比）
    return (totalFails / totalStarts) * 100
  } catch (error) {
    console.error("Failed to calculate failure rate (24h):", error)
    return null
  }
}

/**
 * 计算退款率（过去 24 小时）
 */
async function calculateRefundRate24H(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // 查询所有已支付的订单
    const { data: paidOrders, error: paidError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("status", "paid")
      .gte("updated_at", cutoffTime)

    if (paidError) {
      console.error("Failed to query paid orders (24h):", paidError)
      return null
    }

    // 查询所有已退款的订单
    const { data: refundedOrders, error: refundError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("status", "refunded")
      .gte("updated_at", cutoffTime)

    if (refundError) {
      console.error("Failed to query refunded orders (24h):", refundError)
      return null
    }

    const totalPaid = paidOrders?.length || 0
    const totalRefunded = refundedOrders?.length || 0

    if (totalPaid === 0) {
      return null
    }

    // 计算退款率（百分比）
    return (totalRefunded / totalPaid) * 100
  } catch (error) {
    console.error("Failed to calculate refund rate (24h):", error)
    return null
  }
}

/**
 * 计算 GDPR 任务完成率（过去 24 小时）
 */
async function calculateGDPRCompletionRate24H(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

    // 查询所有删除请求
    const { data: totalRequests, error: totalError } = await supabase
      .from("gdpr_requests")
      .select("id, status, created_at, completed_at")
      .eq("request_type", "delete")
      .gte("created_at", cutoffTime)

    if (totalError) {
      console.error("Failed to query GDPR requests (24h):", totalError)
      return null
    }

    if (!totalRequests || totalRequests.length === 0) {
      return 100 // 如果没有请求，完成率为 100%
    }

    // 计算已完成的请求（72 小时内完成）
    const completedRequests = totalRequests.filter((req) => {
      if (req.status !== "completed" || !req.completed_at) {
        return false
      }
      const createdTime = new Date(req.created_at).getTime()
      const completedTime = new Date(req.completed_at).getTime()
      const timeDiff = completedTime - createdTime
      return timeDiff <= 72 * 60 * 60 * 1000 // 72 小时
    })

    const total = totalRequests.length
    const completed = completedRequests.length

    // 计算完成率（百分比）
    return (completed / total) * 100
  } catch (error) {
    console.error("Failed to calculate GDPR completion rate (24h):", error)
    return null
  }
}

/**
 * 计算所有 24 小时核心指标
 */
export async function calculateMetrics24H(): Promise<Metrics24H> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      p95_latency_ms: null,
      failure_rate_percent: null,
      refund_rate_percent: null,
      gdpr_completion_rate_percent: null,
      last_updated: new Date().toISOString(),
      period_hours: WINDOW_HOURS,
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const [p95, failureRate, refundRate, gdprCompletion] = await Promise.all([
    calculateP95Latency24H(supabase),
    calculateFailureRate24H(supabase),
    calculateRefundRate24H(supabase),
    calculateGDPRCompletionRate24H(supabase),
  ])

  return {
    p95_latency_ms: p95,
    failure_rate_percent: failureRate,
    refund_rate_percent: refundRate,
    gdpr_completion_rate_percent: gdprCompletion,
    last_updated: new Date().toISOString(),
    period_hours: WINDOW_HOURS,
  }
}




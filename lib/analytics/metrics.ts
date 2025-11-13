/**
 * Analytics Metrics Calculator
 * 
 * 计算核心指标：
 * - p95 延迟（过去 5 分钟）
 * - 失败率（过去 5 分钟）
 * - 退款率（过去 5 分钟）
 * 
 * 每 5 分钟更新一次，数据保留 180 天
 */

import { createClient } from "@supabase/supabase-js"

export interface AnalyticsMetrics {
  p95_latency_ms: number | null
  failure_rate_percent: number | null
  refund_rate_percent: number | null
  last_updated: string
  period_minutes: number
}

const WINDOW_MINUTES = 5 // 5 分钟窗口
const RETENTION_DAYS = 180 // 保留 180 天

/**
 * 计算 p95 延迟（过去 5 分钟）
 */
async function calculateP95Latency(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    // 查询过去 5 分钟的所有事件，包含 duration_ms
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
    console.error("Failed to calculate p95 latency:", error)
    return null
  }
}

/**
 * 计算失败率（过去 5 分钟）
 */
async function calculateFailureRate(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

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
      console.error("Failed to query start events:", startError)
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
      console.error("Failed to query fail events:", failError)
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
    console.error("Failed to calculate failure rate:", error)
    return null
  }
}

/**
 * 计算退款率（过去 5 分钟）
 */
async function calculateRefundRate(
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    // 查询所有已支付的订单
    const { data: paidOrders, error: paidError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("status", "paid")
      .gte("updated_at", cutoffTime)

    if (paidError) {
      console.error("Failed to query paid orders:", paidError)
      return null
    }

    // 查询所有已退款的订单
    const { data: refundedOrders, error: refundError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("status", "refunded")
      .gte("updated_at", cutoffTime)

    if (refundError) {
      console.error("Failed to query refunded orders:", refundError)
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
    console.error("Failed to calculate refund rate:", error)
    return null
  }
}

/**
 * 计算所有核心指标
 */
export async function calculateMetrics(): Promise<AnalyticsMetrics> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      p95_latency_ms: null,
      failure_rate_percent: null,
      refund_rate_percent: null,
      last_updated: new Date().toISOString(),
      period_minutes: WINDOW_MINUTES,
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const [p95, failureRate, refundRate] = await Promise.all([
    calculateP95Latency(supabase),
    calculateFailureRate(supabase),
    calculateRefundRate(supabase),
  ])

  return {
    p95_latency_ms: p95,
    failure_rate_percent: failureRate,
    refund_rate_percent: refundRate,
    last_updated: new Date().toISOString(),
    period_minutes: WINDOW_MINUTES,
  }
}

/**
 * 通过 request_id 查询事件
 */
export async function getEventsByRequestId(
  requestId: string
): Promise<Array<{ event_type: string; event_data: any; created_at: string }>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

    // 查询所有事件，然后在内存中过滤 request_id
    const { data, error } = await supabase
      .from("analytics_logs")
      .select("event_type, event_data, created_at")
      .order("created_at", { ascending: true })
      .limit(10000) // 限制查询数量，避免性能问题

  if (error) {
    console.error("Failed to query events by request_id:", error)
    return []
  }

  // 在内存中过滤 request_id
  const filteredEvents = (data || [])
    .map((event) => ({
      event_type: event.event_type,
      event_data: event.event_data as any,
      created_at: event.created_at,
    }))
    .filter((event) => event.event_data?.request_id === requestId)

  return filteredEvents
}


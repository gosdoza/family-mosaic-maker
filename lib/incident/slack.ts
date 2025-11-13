/**
 * Incident + Slack 通知
 * 
 * 當連續 30 分鐘超閾值（失敗率>2% 或 p95>8s）時，發 Slack #oncall
 */

import { createClient } from "@supabase/supabase-js"

export interface IncidentAlert {
  type: "failure_rate" | "p95_latency"
  threshold: number
  actual: number
  duration_minutes: number
  timestamp: string
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const SLACK_ONCALL_CHANNEL = process.env.SLACK_ONCALL_CHANNEL || "#oncall"

/**
 * 發送 Slack 通知
 */
export async function sendSlackAlert(alert: IncidentAlert): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("[Slack] SLACK_WEBHOOK_URL not configured, skipping alert")
    return false
  }

  try {
    const message = formatSlackMessage(alert)

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: SLACK_ONCALL_CHANNEL,
        text: `🚨 Incident Alert: ${alert.type}`,
        blocks: message,
      }),
    })

    if (!response.ok) {
      console.error("[Slack] Failed to send alert:", response.statusText)
      return false
    }

    console.log("[Slack] Alert sent successfully")
    return true
  } catch (error) {
    console.error("[Slack] Error sending alert:", error)
    return false
  }
}

/**
 * 格式化 Slack 訊息
 */
function formatSlackMessage(alert: IncidentAlert): any[] {
  const threshold = alert.type === "failure_rate" ? "2%" : "8s"
  const actual = alert.type === "failure_rate" 
    ? `${alert.actual.toFixed(2)}%` 
    : `${(alert.actual / 1000).toFixed(2)}s`

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Incident Alert: ${alert.type}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Type:*\n${alert.type}`,
        },
        {
          type: "mrkdwn",
          text: `*Threshold:*\n${threshold}`,
        },
        {
          type: "mrkdwn",
          text: `*Actual:*\n${actual}`,
        },
        {
          type: "mrkdwn",
          text: `*Duration:*\n${alert.duration_minutes} minutes`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Timestamp:* ${new Date(alert.timestamp).toISOString()}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Required:* Please investigate the incident and take appropriate action.`,
      },
    },
  ]
}

/**
 * 檢查是否連續 30 分鐘超閾值
 */
export async function checkIncidentThresholds(): Promise<IncidentAlert | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("[Incident] Missing Supabase credentials")
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // 檢查過去 30 分鐘的指標
  const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  // 計算失敗率
  const failureRate = await calculateFailureRate(supabase, cutoffTime)
  if (failureRate !== null && failureRate > 2.0) {
    return {
      type: "failure_rate",
      threshold: 2.0,
      actual: failureRate,
      duration_minutes: 30,
      timestamp: new Date().toISOString(),
    }
  }

  // 計算 p95 延遲
  const p95Latency = await calculateP95Latency(supabase, cutoffTime)
  if (p95Latency !== null && p95Latency > 8000) {
    return {
      type: "p95_latency",
      threshold: 8000,
      actual: p95Latency,
      duration_minutes: 30,
      timestamp: new Date().toISOString(),
    }
  }

  return null
}

/**
 * 計算失敗率
 */
async function calculateFailureRate(
  supabase: ReturnType<typeof createClient>,
  cutoffTime: string
): Promise<number | null> {
  try {
    // 查詢所有開始事件
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

    // 查詢所有失敗事件
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

    // 過濾出真正有錯誤的事件
    const actualFails = (failEvents || []).filter((event) => {
      const eventData = event.event_data as any
      return eventData?.error != null
    })

    const totalStarts = startEvents?.length || 0
    const totalFails = actualFails.length

    if (totalStarts === 0) {
      return null
    }

    // 計算失敗率（百分比）
    return (totalFails / totalStarts) * 100
  } catch (error) {
    console.error("Failed to calculate failure rate:", error)
    return null
  }
}

/**
 * 計算 p95 延遲
 */
async function calculateP95Latency(
  supabase: ReturnType<typeof createClient>,
  cutoffTime: string
): Promise<number | null> {
  try {
    // 查詢過去 30 分鐘的所有事件，包含 duration_ms
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

    // 計算 p95（第 95 百分位）
    const p95Index = Math.floor(durations.length * 0.95)
    return durations[p95Index] || null
  } catch (error) {
    console.error("Failed to calculate p95 latency:", error)
    return null
  }
}




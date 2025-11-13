/**
 * Analytics Client
 * 
 * 统一的事件日志服务，将事件发送到：
 * 1. Supabase analytics_logs 表（持久化存储）
 * 2. Logflare（如果配置了 LOGFLARE_API_KEY）
 * 3. Vercel Analytics（通过 @vercel/analytics）
 * 
 * 所有事件都包含 request_id 以便追踪
 */

import { createClient as createServiceClient } from "@supabase/supabase-js"

export interface AnalyticsEvent {
  event_type: string
  request_id?: string
  user_id?: string | null
  job_id?: string
  order_id?: string
  error?: string
  duration_ms?: number
  data?: Record<string, any>
}

const LOGFLARE_API_KEY = process.env.LOGFLARE_API_KEY
const LOGFLARE_SOURCE_ID = process.env.LOGFLARE_SOURCE_ID
const LOGFLARE_URL = process.env.LOGFLARE_URL || "https://api.logflare.app"

/**
 * 发送事件到 Logflare
 */
async function sendToLogflare(event: AnalyticsEvent): Promise<void> {
  if (!LOGFLARE_API_KEY || !LOGFLARE_SOURCE_ID) {
    return // Logflare 未配置，跳过
  }

  try {
    const logEntry = {
      message: event.event_type,
      metadata: {
        event_type: event.event_type,
        request_id: event.request_id,
        user_id: event.user_id,
        job_id: event.job_id,
        order_id: event.order_id,
        error: event.error,
        duration_ms: event.duration_ms,
        ...event.data,
        timestamp: new Date().toISOString(),
      },
    }

    await fetch(`${LOGFLARE_URL}/api/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": LOGFLARE_API_KEY,
      },
      body: JSON.stringify({
        source: LOGFLARE_SOURCE_ID,
        log_entry: logEntry,
      }),
    })
  } catch (error) {
    // 静默失败，不影响主流程
    console.warn("[Analytics] Failed to send to Logflare:", error)
  }
}

/**
 * 发送事件到 Supabase analytics_logs
 */
async function sendToSupabase(event: AnalyticsEvent): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return // Supabase 未配置，跳过
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    await serviceClient.from("analytics_logs").insert({
      event_type: event.event_type,
      event_data: {
        request_id: event.request_id,
        job_id: event.job_id,
        order_id: event.order_id,
        error: event.error,
        duration_ms: event.duration_ms,
        ...event.data,
      },
      user_id: event.user_id || null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // 静默失败，不影响主流程
    console.warn("[Analytics] Failed to send to Supabase:", error)
  }
}

/**
 * 记录 analytics 事件
 * 
 * 非阻塞，fire-and-forget 模式
 * 同时发送到 Supabase 和 Logflare（如果配置了）
 */
export async function logAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  // 并行发送到所有目标，不等待结果
  Promise.all([sendToSupabase(event), sendToLogflare(event)]).catch((error) => {
    // 静默失败，不影响主流程
    console.warn("[Analytics] Failed to log event:", error)
  })
}

/**
 * 追踪事件（用于前端）
 * 
 * 发送到 /api/metrics 端点，然后由后端记录到 analytics
 */
export async function trackEvent(event: {
  event: string
  request_id?: string
  jobId?: string
  orderId?: string
  metadata?: Record<string, any>
}): Promise<void> {
  try {
    // Fire and forget - don't wait for response
    fetch("/api/metrics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }).catch((error) => {
      // Silently fail - metrics should not break the app
      console.warn("Failed to track event:", error)
    })
  } catch (error) {
    // Silently fail - metrics should not break the app
    console.warn("Failed to track event:", error)
  }
}




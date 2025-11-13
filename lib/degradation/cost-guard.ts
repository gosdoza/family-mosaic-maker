/**
 * Cost Guard
 * 
 * 成本監控和自動降級：
 * - 連續 30 分鐘失敗率 > 2% → 自動降級
 * - 連續 30 分鐘 p95 > 8s → 自動降級
 * - 連續 30 分鐘單張成本 > $0.30 → 自動降級
 * 
 * 降級動作：
 * - 降低解析度/步數
 * - GEN_PROVIDER_WEIGHTS 回退至 FAL: 1.0
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 紅線閾值
const FAILURE_RATE_THRESHOLD = 2.0 // 2%
const P95_LATENCY_THRESHOLD = 8000 // 8 秒 (8000ms)
const COST_PER_IMAGE_THRESHOLD = 0.30 // $0.30
const DETECTION_WINDOW_MINUTES = 30 // 30 分鐘

export interface CostGuardStatus {
  triggered: boolean
  reasons: string[]
  metrics: {
    failure_rate_percent: number | null
    p95_latency_ms: number | null
    cost_per_image: number | null
  }
  actions: {
    provider_weights_rolled_back: boolean
    resolution_degraded: boolean
    steps_degraded: boolean
  }
  timestamp: string | null
}

/**
 * 計算最近 30 分鐘的指標
 * 導出以供外部使用
 */
export async function calculateMetrics30Min(): Promise<{
  failure_rate_percent: number | null
  p95_latency_ms: number | null
  cost_per_image: number | null
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      failure_rate_percent: null,
      p95_latency_ms: null,
      cost_per_image: null,
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const cutoffTime = new Date(Date.now() - DETECTION_WINDOW_MINUTES * 60 * 1000).toISOString()

  // 1. 計算失敗率
  const { data: startEvents } = await supabase
    .from("analytics_logs")
    .select("event_type")
    .gte("created_at", cutoffTime)
    .in("event_type", ["gen_start", "checkout_init", "payment_started", "download_started"])

  const { data: failEvents } = await supabase
    .from("analytics_logs")
    .select("event_type, event_data")
    .gte("created_at", cutoffTime)
    .in("event_type", ["gen_fail", "checkout_fail", "payment_failed", "download_failed"])

  const totalStarts = startEvents?.length || 0
  const actualFails = (failEvents || []).filter((event) => {
    const eventData = event.event_data as any
    return eventData?.error != null
  }).length

  const failure_rate_percent = totalStarts > 0 ? (actualFails / totalStarts) * 100 : null

  // 2. 計算 p95 延遲
  const { data: routeEvents } = await supabase
    .from("analytics_logs")
    .select("event_data")
    .eq("event_type", "gen_route")
    .gte("created_at", cutoffTime)
    .not("event_data->latency_ms", "is", null)

  const latencies = (routeEvents || [])
    .map((row) => {
      const eventData = row.event_data as any
      return eventData?.latency_ms
    })
    .filter((d): d is number => typeof d === "number" && d > 0)
    .sort((a, b) => a - b)

  const p95_latency_ms =
    latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || null : null

  // 3. 計算單張成本
  const { data: costEvents } = await supabase
    .from("analytics_logs")
    .select("event_data")
    .eq("event_type", "gen_route")
    .gte("created_at", cutoffTime)
    .not("event_data->cost_per_image", "is", null)

  const costs = (costEvents || [])
    .map((row) => {
      const eventData = row.event_data as any
      return eventData?.cost_per_image
    })
    .filter((d): d is number => typeof d === "number" && d > 0)

  const cost_per_image = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null

  return {
    failure_rate_percent,
    p95_latency_ms,
    cost_per_image,
  }
}

/**
 * 執行降級動作
 */
async function executeDowngradeActions(reasons: string[]): Promise<{
  provider_weights_rolled_back: boolean
  resolution_degraded: boolean
  steps_degraded: boolean
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      provider_weights_rolled_back: false,
      resolution_degraded: false,
      steps_degraded: false,
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  let provider_weights_rolled_back = false
  let resolution_degraded = false
  let steps_degraded = false

  try {
    // 1. 回退供應商權重到 FAL: 1.0
    const { error: weightsError } = await supabase.from("feature_flags").upsert(
      {
        flag_key: "GEN_PROVIDER_WEIGHTS",
        flag_value: false,
        flag_value_text: JSON.stringify({ fal: 1.0, runware: 0.0 }),
        description: "Provider weights rolled back to FAL: 1.0 (Auto-downgrade)",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "flag_key",
      }
    )

    if (!weightsError) {
      provider_weights_rolled_back = true
      console.log("✅ Provider weights rolled back to FAL: 1.0")
    } else {
      console.error("Failed to rollback provider weights:", weightsError)
    }

    // 2. 降低解析度（標記降級）
    const { error: resolutionError } = await supabase.from("feature_flags").upsert(
      {
        flag_key: "resolution_degraded",
        flag_value: true,
        flag_value_text: "768",
        description: "Resolution degraded to 768x768 (Auto-downgrade)",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "flag_key",
      }
    )

    if (!resolutionError) {
      resolution_degraded = true
      console.log("✅ Resolution degraded to 768x768")
    } else {
      console.error("Failed to degrade resolution:", resolutionError)
    }

    // 3. 降低步數（標記降級）
    const { error: stepsError } = await supabase.from("feature_flags").upsert(
      {
        flag_key: "steps_degraded",
        flag_value: true,
        flag_value_text: "20",
        description: "Steps degraded to 20 (Auto-downgrade)",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "flag_key",
      }
    )

    if (!stepsError) {
      steps_degraded = true
      console.log("✅ Steps degraded to 20")
    } else {
      console.error("Failed to degrade steps:", stepsError)
    }
  } catch (error) {
    console.error("Error executing downgrade actions:", error)
  }

  return {
    provider_weights_rolled_back,
    resolution_degraded,
    steps_degraded,
  }
}

/**
 * 記錄 auto_downgrade 事件
 */
async function logAutoDowngradeEvent(
  reasons: string[],
  metrics: {
    failure_rate_percent: number | null
    p95_latency_ms: number | null
    cost_per_image: number | null
  },
  actions: {
    provider_weights_rolled_back: boolean
    resolution_degraded: boolean
    steps_degraded: boolean
  }
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    await supabase.from("analytics_logs").insert({
      event_type: "auto_downgrade",
      event_data: {
        triggered_by: "auto",
        reason: reasons.join("; "),
        metrics: {
          failure_rate_percent: metrics.failure_rate_percent,
          p95_latency_ms: metrics.p95_latency_ms,
          cost_per_image: metrics.cost_per_image,
        },
        actions: {
          provider_weights_rolled_back: actions.provider_weights_rolled_back,
          resolution_degraded: actions.resolution_degraded,
          steps_degraded: actions.steps_degraded,
        },
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })

    console.log("✅ auto_downgrade event logged")
  } catch (error) {
    console.error("Failed to log auto_downgrade event:", error)
  }
}

/**
 * 檢查並執行成本監控降級
 */
export async function checkAndDowngrade(): Promise<CostGuardStatus> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      triggered: false,
      reasons: [],
      metrics: {
        failure_rate_percent: null,
        p95_latency_ms: null,
        cost_per_image: null,
      },
      actions: {
        provider_weights_rolled_back: false,
        resolution_degraded: false,
        steps_degraded: false,
      },
      timestamp: null,
    }
  }

  try {
    // 1. 計算指標
    const metrics = await calculateMetrics30Min()

    // 2. 檢查紅線
    const reasons: string[] = []

    if (metrics.failure_rate_percent !== null && metrics.failure_rate_percent > FAILURE_RATE_THRESHOLD) {
      reasons.push(
        `Failure rate ${metrics.failure_rate_percent.toFixed(2)}% exceeds threshold ${FAILURE_RATE_THRESHOLD}%`
      )
    }

    if (metrics.p95_latency_ms !== null && metrics.p95_latency_ms > P95_LATENCY_THRESHOLD) {
      reasons.push(
        `P95 latency ${metrics.p95_latency_ms}ms exceeds threshold ${P95_LATENCY_THRESHOLD}ms`
      )
    }

    if (metrics.cost_per_image !== null && metrics.cost_per_image > COST_PER_IMAGE_THRESHOLD) {
      reasons.push(
        `Cost per image $${metrics.cost_per_image.toFixed(2)} exceeds threshold $${COST_PER_IMAGE_THRESHOLD}`
      )
    }

    const triggered = reasons.length > 0

    if (!triggered) {
      return {
        triggered: false,
        reasons: [],
        metrics,
        actions: {
          provider_weights_rolled_back: false,
          resolution_degraded: false,
          steps_degraded: false,
        },
        timestamp: null,
      }
    }

    // 3. 執行降級動作
    const actions = await executeDowngradeActions(reasons)

    // 4. 記錄 auto_downgrade 事件
    await logAutoDowngradeEvent(reasons, metrics, actions)

    return {
      triggered: true,
      reasons,
      metrics,
      actions,
      timestamp: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error("Error in cost guard check:", error)
    return {
      triggered: false,
      reasons: [`Error: ${error.message}`],
      metrics: {
        failure_rate_percent: null,
        p95_latency_ms: null,
        cost_per_image: null,
      },
      actions: {
        provider_weights_rolled_back: false,
        resolution_degraded: false,
        steps_degraded: false,
      },
      timestamp: null,
    }
  }
}


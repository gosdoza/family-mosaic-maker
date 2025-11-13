/**
 * Degradation Manager
 * 
 * 管理系统降级状态：
 * - 更新 feature_flags
 * - 记录到 Runbook
 * - 支持手动降级和回滚
 */

import { createClient } from "@supabase/supabase-js"
import { detectDegradation } from "./detector"
import { updateRunbook } from "./runbook"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const DEGRADED_FLAG_KEY = "system_degraded"

/**
 * 获取当前降级状态
 */
export async function getDegradationStatus(): Promise<{
  isDegraded: boolean
  flagValue: boolean | null
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      isDegraded: false,
      flagValue: null,
    }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: flag, error } = await supabase
      .from("feature_flags")
      .select("flag_value")
      .eq("flag_key", DEGRADED_FLAG_KEY)
      .maybeSingle()

    if (error && !error.message.includes("does not exist")) {
      console.error("Error fetching degradation flag:", error)
      return {
        isDegraded: false,
        flagValue: null,
      }
    }

    return {
      isDegraded: flag?.flag_value === true,
      flagValue: flag?.flag_value ?? null,
    }
  } catch (error) {
    console.error("Error getting degradation status:", error)
    return {
      isDegraded: false,
      flagValue: null,
    }
  }
}

/**
 * 设置降级状态
 */
export async function setDegradationStatus(
  isDegraded: boolean,
  reason: string,
  triggeredBy: "auto" | "manual" = "manual"
): Promise<{ success: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      success: false,
      error: "Missing Supabase credentials",
    }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. 更新或创建 feature_flag
    const { error: upsertError } = await supabase
      .from("feature_flags")
      .upsert(
        {
          flag_key: DEGRADED_FLAG_KEY,
          flag_value: isDegraded,
          description: `System degradation status. Set to true when system is degraded. Reason: ${reason}`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "flag_key",
        }
      )

    if (upsertError) {
      console.error("Error updating degradation flag:", upsertError)
      return {
        success: false,
        error: upsertError.message,
      }
    }

    // 2. 记录到 Runbook
    await updateRunbook({
      action: isDegraded ? "degradation" : "rollback",
      triggeredBy,
      reason,
      timestamp: new Date().toISOString(),
    })

    // 3. 记录 analytics 事件
    await supabase.from("analytics_logs").insert({
      event_type: isDegraded ? "degradation_triggered" : "degradation_rollback",
      event_data: {
        reason,
        triggered_by: triggeredBy,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error setting degradation status:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 自动检测并处理降级
 */
export async function autoDetectAndDegrade(): Promise<{
  degraded: boolean
  reason: string | null
}> {
  try {
    // 1. 检测降级条件
    const detection = await detectDegradation()

    if (!detection.isDegraded) {
      return {
        degraded: false,
        reason: null,
      }
    }

    // 2. 检查当前状态
    const currentStatus = await getDegradationStatus()

    // 3. 如果已经降级，不需要重复设置
    if (currentStatus.isDegraded) {
      return {
        degraded: true,
        reason: "Already degraded",
      }
    }

    // 4. 设置降级状态
    const result = await setDegradationStatus(
      true,
      detection.reason || "Auto-detected degradation",
      "auto"
    )

    if (!result.success) {
      return {
        degraded: false,
        reason: result.error || "Failed to set degradation status",
      }
    }

    return {
      degraded: true,
      reason: detection.reason || "Auto-detected degradation",
    }
  } catch (error: any) {
    console.error("Error in auto detect and degrade:", error)
    return {
      degraded: false,
      reason: error.message,
    }
  }
}




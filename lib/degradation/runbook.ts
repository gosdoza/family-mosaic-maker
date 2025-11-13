/**
 * Runbook Manager
 * 
 * 管理 Runbook 记录：
 * - 自动更新 Runbook 记录
 * - 记录降级和回滚操作
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const RUNBOOK_TABLE = "runbook_logs"

export interface RunbookEntry {
  action: "degradation" | "rollback" | "manual_check"
  triggeredBy: "auto" | "manual"
  reason: string
  timestamp: string
  details?: Record<string, any>
}

/**
 * 更新 Runbook 记录
 */
export async function updateRunbook(entry: RunbookEntry): Promise<{ success: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // 如果 Supabase 未配置，只记录到控制台
    console.log("[Runbook]", entry)
    return {
      success: true,
    }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 检查 runbook_logs 表是否存在，如果不存在则创建
    // 注意：这里我们使用 analytics_logs 作为临时存储
    // 实际生产环境应该创建专门的 runbook_logs 表

    // 使用 analytics_logs 存储 Runbook 记录
    const { error } = await supabase.from("analytics_logs").insert({
      event_type: "runbook_entry",
      event_data: {
        action: entry.action,
        triggered_by: entry.triggeredBy,
        reason: entry.reason,
        timestamp: entry.timestamp,
        details: entry.details || {},
      },
      created_at: entry.timestamp,
    })

    if (error) {
      console.error("Error updating Runbook:", error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error updating Runbook:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 获取最近的 Runbook 记录
 */
export async function getRecentRunbookEntries(limit: number = 10): Promise<RunbookEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return []
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase
      .from("analytics_logs")
      .select("event_data, created_at")
      .eq("event_type", "runbook_entry")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching Runbook entries:", error)
      return []
    }

    return (data || []).map((row) => {
      const eventData = row.event_data as any
      return {
        action: eventData?.action || "unknown",
        triggeredBy: eventData?.triggered_by || "unknown",
        reason: eventData?.reason || "",
        timestamp: eventData?.timestamp || row.created_at,
        details: eventData?.details || {},
      } as RunbookEntry
    })
  } catch (error) {
    console.error("Error fetching Runbook entries:", error)
    return []
  }
}




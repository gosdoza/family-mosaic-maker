/**
 * Preview Bypass Key 輪替管理
 * 
 * 管理 Vercel Preview 保護繞過鍵的輪替：
 * - 生成新的 bypass key
 * - 標註舊鍵註銷時間
 * - 驗證新鍵可用，舊鍵不可用
 */

import { createClient } from "@supabase/supabase-js"

export interface BypassKey {
  id: string
  key: string
  environment: "preview" | "production"
  status: "active" | "revoked"
  created_at: string
  revoked_at: string | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * 生成新的 bypass key
 */
export async function generateBypassKey(environment: "preview" | "production"): Promise<string> {
  // 生成隨機 bypass key（32 字符）
  const key = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // 保存到數據庫（如果配置了 Supabase）
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      // 先撤銷所有舊的 active keys
      await supabase
        .from("bypass_keys")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("environment", environment)
        .eq("status", "active")

      // 創建新的 bypass key
      await supabase.from("bypass_keys").insert({
        key,
        environment,
        status: "active",
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Failed to save bypass key to database:", error)
      // 繼續返回 key，即使數據庫保存失敗
    }
  }

  return key
}

/**
 * 撤銷 bypass key
 */
export async function revokeBypassKey(keyId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return false
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { error } = await supabase
      .from("bypass_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("id", keyId)

    if (error) {
      console.error("Failed to revoke bypass key:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error revoking bypass key:", error)
    return false
  }
}

/**
 * 驗證 bypass key 是否有效
 */
export async function verifyBypassKey(
  key: string,
  environment: "preview" | "production"
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // 如果未配置 Supabase，使用環境變數驗證
    const envKey = process.env.VERCEL_BYPASS_TOKEN
    return envKey === key
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase
      .from("bypass_keys")
      .select("id, status")
      .eq("key", key)
      .eq("environment", environment)
      .eq("status", "active")
      .maybeSingle()

    if (error) {
      console.error("Failed to verify bypass key:", error)
      return false
    }

    return !!data
  } catch (error) {
    console.error("Error verifying bypass key:", error)
    return false
  }
}

/**
 * 獲取當前的 active bypass key
 */
export async function getActiveBypassKey(
  environment: "preview" | "production"
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // 如果未配置 Supabase，返回環境變數
    return process.env.VERCEL_BYPASS_TOKEN || null
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase
      .from("bypass_keys")
      .select("key")
      .eq("environment", environment)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("Failed to get active bypass key:", error)
      return null
    }

    return data?.key || null
  } catch (error) {
    console.error("Error getting active bypass key:", error)
    return null
  }
}

/**
 * 獲取所有 bypass keys（包括已撤銷的）
 */
export async function getAllBypassKeys(
  environment: "preview" | "production"
): Promise<BypassKey[]> {
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
      .from("bypass_keys")
      .select("*")
      .eq("environment", environment)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to get bypass keys:", error)
      return []
    }

    return (data || []) as BypassKey[]
  } catch (error) {
    console.error("Error getting bypass keys:", error)
    return []
  }
}




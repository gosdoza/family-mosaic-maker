/**
 * PayPal 幂等性管理
 * 
 * 使用 X-Idempotency-Key 防止重复下单
 */

import { createClient as createServiceClient } from "@supabase/supabase-js"

// 内存存储（用于 Mock 模式）
const idempotencyStore = new Map<string, {
  orderId: string
  createdAt: number
  status: string
}>()

/**
 * 检查幂等性 Key 是否已使用
 */
export async function checkIdempotencyKey(key: string): Promise<{
  exists: boolean
  orderId?: string
  status?: string
}> {
  // Mock 模式或測試環境：使用内存存储
  const isTestEnv = process.env.ALLOW_TEST_LOGIN === "true" && process.env.NODE_ENV !== "production"
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true" || process.env.IS_MOCK === "true" || isTestEnv) {
    const existing = idempotencyStore.get(key)
    if (existing) {
      return {
        exists: true,
        orderId: existing.orderId,
        status: existing.status,
      }
    }
    return { exists: false }
  }

  // 生产模式：查询数据库
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await serviceClient
      .from("orders")
      .select("id, status")
      .eq("idempotency_key", key)
      .maybeSingle()

    if (error && !error.message.includes("No rows")) {
      console.error("Error checking idempotency key:", error)
      return { exists: false }
    }

    if (data) {
      return {
        exists: true,
        orderId: data.id,
        status: data.status,
      }
    }

    return { exists: false }
  } catch (error) {
    console.error("Error checking idempotency key:", error)
    return { exists: false }
  }
}

/**
 * 保存幂等性 Key
 */
export async function saveIdempotencyKey(
  key: string,
  orderId: string,
  status: string
): Promise<void> {
  // Mock 模式或測試環境：使用内存存储
  const isTestEnv = process.env.ALLOW_TEST_LOGIN === "true" && process.env.NODE_ENV !== "production"
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true" || process.env.IS_MOCK === "true" || isTestEnv) {
    idempotencyStore.set(key, {
      orderId,
      createdAt: Date.now(),
      status,
    })
    return
  }

  // 生产模式：更新数据库
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    await serviceClient
      .from("orders")
      .update({
        idempotency_key: key,
      })
      .eq("id", orderId)
  } catch (error) {
    console.error("Error saving idempotency key:", error)
    // 不抛出错误，避免影响主流程
  }
}


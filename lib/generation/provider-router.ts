/**
 * Provider Router
 * 
 * 根据权重选择供应商，支持自动故障切换
 */

import { callFalAPI, FalGenerateRequest, FalGenerateResponse } from "./fal-client"
import { callRunwareAPI, RunwareGenerateRequest, RunwareGenerateResponse } from "./runware-client"
import { createClient } from "@supabase/supabase-js"

// 统一的请求接口
export interface ProviderGenerateRequest {
  files: string[]
  style: string
  template: string
  resolution?: number
  steps?: number
  grayscale_ratio?: number
}

// 统一的响应接口
export interface ProviderGenerateResponse {
  jobId: string
  provider: "fal" | "runware"
  latency_ms: number
  attempts: number
  fallback_used: boolean
}

// 环境变量配置
const GEN_PROVIDER_WEIGHTS_ENV = process.env.GEN_PROVIDER_WEIGHTS
const GEN_PROVIDER_PRIMARY_ENV = process.env.GEN_PROVIDER_PRIMARY || "fal"
const GEN_TIMEOUT_MS = parseInt(process.env.GEN_TIMEOUT_MS || "8000", 10)
const GEN_RETRY = parseInt(process.env.GEN_RETRY || "2", 10)
const GEN_FAILOVER = process.env.GEN_FAILOVER === "true"

// 默认权重
const DEFAULT_WEIGHTS = { fal: 1.0, runware: 0.0 }

// 缓存权重配置（避免频繁查询数据库）
let cachedWeights: { fal: number; runware: number } | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5000 // 5 秒缓存

/**
 * 从数据库读取供应商权重配置
 */
async function getProviderWeightsFromDB(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  try {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: flag, error } = await serviceClient
      .from("feature_flags")
      .select("flag_value_text")
      .eq("flag_key", "GEN_PROVIDER_WEIGHTS")
      .maybeSingle()

    if (error || !flag) {
      return null
    }

    return flag.flag_value_text
  } catch (error) {
    console.error("Failed to fetch provider weights from DB:", error)
    return null
  }
}

/**
 * 解析供应商权重配置
 * 优先级：环境变量 > 数据库 > 默认值
 */
async function parseProviderWeights(): Promise<{ fal: number; runware: number }> {
  // 检查缓存
  const now = Date.now()
  if (cachedWeights && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedWeights
  }

  let weightsStr: string | null = null

  // 1. 优先从环境变量读取
  if (GEN_PROVIDER_WEIGHTS_ENV) {
    weightsStr = GEN_PROVIDER_WEIGHTS_ENV
  } else {
    // 2. 从数据库读取
    weightsStr = await getProviderWeightsFromDB()
  }

  // 3. 如果都没有，使用默认值
  if (!weightsStr) {
    cachedWeights = DEFAULT_WEIGHTS
    cacheTimestamp = now
    return DEFAULT_WEIGHTS
  }

  try {
    const weights = JSON.parse(weightsStr)
    // 归一化权重
    const total = (weights.fal || 0) + (weights.runware || 0)
    if (total === 0) {
      cachedWeights = DEFAULT_WEIGHTS
      cacheTimestamp = now
      return DEFAULT_WEIGHTS
    }
    const normalized = {
      fal: (weights.fal || 0) / total,
      runware: (weights.runware || 0) / total,
    }
    cachedWeights = normalized
    cacheTimestamp = now
    return normalized
  } catch (error) {
    console.error("Failed to parse GEN_PROVIDER_WEIGHTS:", error)
    cachedWeights = DEFAULT_WEIGHTS
    cacheTimestamp = now
    return DEFAULT_WEIGHTS
  }
}

/**
 * 加权随机选择供应商
 */
function selectProviderByWeight(weights: { fal: number; runware: number }): "fal" | "runware" {
  const random = Math.random()
  if (random < weights.fal) {
    return "fal"
  }
  return "runware"
}

/**
 * 选择供应商（根据主要供应商或权重）
 */
async function selectProvider(): Promise<"fal" | "runware"> {
  const weights = await parseProviderWeights()
  
  // 如果主要供应商已配置，优先使用
  if (GEN_PROVIDER_PRIMARY_ENV === "fal" || GEN_PROVIDER_PRIMARY_ENV === "runware") {
    // 如果主要供应商权重为 0，使用权重选择
    if (GEN_PROVIDER_PRIMARY_ENV === "fal" && weights.fal === 0) {
      return selectProviderByWeight(weights)
    }
    if (GEN_PROVIDER_PRIMARY_ENV === "runware" && weights.runware === 0) {
      return selectProviderByWeight(weights)
    }
    return GEN_PROVIDER_PRIMARY_ENV
  }
  
  // 否则使用权重选择
  return selectProviderByWeight(weights)
}

/**
 * 获取备用供应商
 */
function getFallbackProvider(provider: "fal" | "runware"): "fal" | "runware" {
  return provider === "fal" ? "runware" : "fal"
}

/**
 * 调用供应商 API
 */
async function callProviderAPI(
  provider: "fal" | "runware",
  request: ProviderGenerateRequest
): Promise<{ response: FalGenerateResponse | RunwareGenerateResponse; latency_ms: number }> {
  const startTime = Date.now()

  if (provider === "fal") {
    const response = await callFalAPI(request as FalGenerateRequest, {
      timeout: GEN_TIMEOUT_MS,
      maxRetries: GEN_RETRY,
    })
    const latency_ms = Date.now() - startTime
    return { response, latency_ms }
  } else {
    const response = await callRunwareAPI(request as RunwareGenerateRequest, {
      timeout: GEN_TIMEOUT_MS,
      maxRetries: GEN_RETRY,
    })
    const latency_ms = Date.now() - startTime
    return { response, latency_ms }
  }
}

/**
 * 记录 analytics_logs
 */
async function logGenRouteEvent(data: {
  provider: "fal" | "runware"
  latency_ms: number
  attempts: number
  fallback_used: boolean
  request_id: string
  user_id: string
  error?: string
}) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase credentials for analytics logging")
      return
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    await serviceClient.from("analytics_logs").insert({
      event_type: "gen_route",
      event_data: {
        provider: data.provider,
        latency_ms: data.latency_ms,
        attempts: data.attempts,
        fallback_used: data.fallback_used,
        request_id: data.request_id,
        error: data.error,
      },
      user_id: data.user_id,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log gen_route event:", error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 路由生成请求到供应商
 */
export async function routeGenerateRequest(
  request: ProviderGenerateRequest,
  options: {
    request_id: string
    user_id: string
  }
): Promise<ProviderGenerateResponse> {
  const { request_id, user_id } = options
  const overallStartTime = Date.now()
  let selectedProvider = await selectProvider()
  let fallbackUsed = false
  let attempts = 0
  let lastError: Error | null = null

  // 第一次尝试
  attempts++
  const firstProvider = selectedProvider
  try {
    const { response, latency_ms } = await callProviderAPI(selectedProvider, request)
    const totalLatency = Date.now() - overallStartTime

    // 记录成功事件
    await logGenRouteEvent({
      provider: selectedProvider,
      latency_ms: totalLatency,
      attempts,
      fallback_used: false,
      request_id,
      user_id,
    })

    return {
      jobId: response.jobId,
      provider: selectedProvider,
      latency_ms: totalLatency,
      attempts,
      fallback_used: false,
    }
  } catch (error: any) {
    lastError = error
    const firstAttemptLatency = Date.now() - overallStartTime

    console.error(`Provider ${selectedProvider} failed:`, error.message)

    // 如果启用了故障切换，尝试备用供应商
    if (GEN_FAILOVER) {
      const fallbackProvider = getFallbackProvider(selectedProvider)
      console.log(`Failover: switching from ${selectedProvider} to ${fallbackProvider}`)

      attempts++
      fallbackUsed = true
      selectedProvider = fallbackProvider

      try {
        const { response, latency_ms: fallbackLatency } = await callProviderAPI(
          fallbackProvider,
          request
        )
        const totalLatency = Date.now() - overallStartTime

        // 记录故障切换成功事件
        await logGenRouteEvent({
          provider: fallbackProvider,
          latency_ms: totalLatency,
          attempts,
          fallback_used: true,
          request_id,
          user_id,
        })

        return {
          jobId: response.jobId,
          provider: fallbackProvider,
          latency_ms: totalLatency,
          attempts,
          fallback_used: true,
        }
      } catch (fallbackError: any) {
        console.error(`Fallback provider ${fallbackProvider} also failed:`, fallbackError.message)
        lastError = fallbackError
        const totalLatency = Date.now() - overallStartTime

        // 记录故障切换失败事件
        await logGenRouteEvent({
          provider: fallbackProvider,
          latency_ms: totalLatency,
          attempts,
          fallback_used: true,
          request_id,
          user_id,
          error: fallbackError.message,
        })

        throw new Error(
          `Both providers failed. Primary (${firstProvider}): ${lastError?.message}, Fallback (${fallbackProvider}): ${fallbackError.message}`
        )
      }
    } else {
      // 未启用故障切换，直接抛出错误
      await logGenRouteEvent({
        provider: selectedProvider,
        latency_ms: firstAttemptLatency,
        attempts,
        fallback_used: false,
        request_id,
        user_id,
        error: error.message,
      })

      throw error
    }
  }
}


import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRunwareHealth } from "@/lib/generation/runware-client"
import { checkFalHealth } from "@/lib/generation/fal-client"
import { calculateMetrics } from "@/lib/analytics/metrics"
import { getDegradationStatus } from "@/lib/degradation/manager"

export const runtime = "nodejs" // 避免 Edge 上奇怪的保護/路由干擾
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/health
 * 
 * 健康檢查端點，包含 retention、fal、runware (deprecated)、analytics 指標和降級狀態
 */
export async function GET() {
  // 测试模式：非 production 且 ALLOW_TEST_LOGIN=true 时，直接返回健康状态
  const isTestMode = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_LOGIN === 'true'
  
  if (isTestMode) {
    return NextResponse.json(
      {
        ok: true,
        status: 'healthy',
        time: new Date().toISOString(),
        providers: {
          fal: { ok: true, configured: true },
          runware: { ok: true, configured: true, deprecated: true },
          config: {
            primary: 'fal',
            weights: { fal: 0, runware: 1 },
            timeout_ms: 8000,
            retry: 2,
            failover: true,
          },
        },
        degradation: {
          isDegraded: false,
          flagValue: null,
        },
        settings: {
          model_provider: 'mock',
          model_id: null,
          use_mock: false,
          fal_configured: true,
          fal_model_id: 'fal-ai/flux/schnell',
        },
      },
      { status: 200 }
    )
  }

  // 获取降级状态
  const degradation = await getDegradationStatus()

  // 获取 providers 状态
  const providersStatus = await getProvidersStatus()
  
  // 检查权重 >0 的供应商是否可用
  const overallOk = await checkProvidersAvailability(providersStatus)

  const health = {
    ok: !degradation.isDegraded && overallOk, // 如果降级或供应商不可用，ok 为 false
    status: degradation.isDegraded ? "degraded" : (overallOk ? "healthy" : "unhealthy"),
    time: new Date().toISOString(),
    retention: await getRetentionStatus(),
    fal: await getFalStatus(),
    runware: {
      ...(await getRunwareStatus()),
      deprecated: true, // Runware 已弃用，使用 FAL 替代
    },
    providers: providersStatus,
    analytics: await calculateMetrics(),
    degradation: {
      isDegraded: degradation.isDegraded,
      flagValue: degradation.flagValue,
    },
    settings: await getSettingsDiagnostics(),
  }

  return new NextResponse(
    JSON.stringify(health),
    {
      status: 200, // 始终返回 200，即使降级
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0",
      },
    }
  )
}

/**
 * 獲取 Retention 狀態（僅摘要）
 */
async function getRetentionStatus() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        lastRunAt: null,
        lastResult: "error",
        lastDeleted: null,
        error: "Missing Supabase credentials",
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 查詢最近一次清理記錄
    const { data, error } = await supabase
      .from("analytics_logs")
      .select("event_data, created_at")
      .eq("event_type", "retention")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        lastRunAt: null,
        lastResult: "unknown",
        lastDeleted: null,
      };
    }

    const eventData = data.event_data as any;
    const totalDeleted =
      (eventData?.results?.originals?.deleted || 0) +
      (eventData?.results?.previews?.deleted || 0) +
      (eventData?.results?.analytics_logs?.deleted || 0);

    return {
      lastRunAt: data.created_at,
      lastResult: eventData?.dryRun ? "dry-run" : "success",
      lastDeleted: totalDeleted,
    };
  } catch (error) {
    console.error("Retention status error:", error);
    return {
      lastRunAt: null,
      lastResult: "error",
      lastDeleted: null,
      error: "Failed to fetch retention status",
    };
  }
}

/**
 * 獲取 FAL 狀態（僅摘要）
 */
async function getFalStatus() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  const isProduction = process.env.NODE_ENV === "production"
  const falApiKey = process.env.FAL_API_KEY

  // Fail-Fast Gate: 如果 Production 且 USE_MOCK=false 且无 key，显示明确错误
  // 保留 Mock 降级只在 Preview 可用
  if (isProduction && !useMock && !falApiKey) {
    return {
      ok: false,
      latency_ms: null,
      error: "FAL_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure FAL_API_KEY.",
      status: "error",
    };
  }

  try {
    const health = await checkFalHealth()
    return {
      ok: health.ok,
      latency_ms: health.latency_ms,
      error: health.error || null,
      status: health.ok ? "ok" : "error",
    };
  } catch (error) {
    console.error("FAL status error:", error);
    return {
      ok: false,
      latency_ms: null,
      error: "Failed to check FAL health",
      status: "error",
    };
  }
}

/**
 * 从数据库读取供应商权重配置
 */
async function getProviderWeightsFromDB(): Promise<{ fal: number; runware: number } | null> {
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

    if (error || !flag || !flag.flag_value_text) {
      return null
    }

    try {
      const weights = JSON.parse(flag.flag_value_text)
      // 归一化权重
      const total = (weights.fal || 0) + (weights.runware || 0)
      if (total === 0) {
        return null
      }
      return {
        fal: (weights.fal || 0) / total,
        runware: (weights.runware || 0) / total,
      }
    } catch (parseError) {
      console.error("Failed to parse provider weights from DB:", parseError)
      return null
    }
  } catch (error) {
    console.error("Failed to fetch provider weights from DB:", error)
    return null
  }
}

/**
 * 獲取 Providers 狀態（FAL + Runware）
 */
async function getProvidersStatus() {
  const falStatus = await getFalStatus()
  const runwareStatus = await getRunwareStatus()
  
  // 獲取環境變數配置
  const genProviderPrimary = process.env.GEN_PROVIDER_PRIMARY || "fal"
  
  // 优先从环境变量读取，否则从数据库读取
  let genProviderWeights: { fal: number; runware: number } = { fal: 1.0, runware: 0.0 }
  if (process.env.GEN_PROVIDER_WEIGHTS) {
    try {
      genProviderWeights = JSON.parse(process.env.GEN_PROVIDER_WEIGHTS)
    } catch (error) {
      console.error("Failed to parse GEN_PROVIDER_WEIGHTS from env:", error)
    }
  } else {
    const dbWeights = await getProviderWeightsFromDB()
    if (dbWeights) {
      genProviderWeights = dbWeights
    }
  }
  
  const genTimeoutMs = parseInt(process.env.GEN_TIMEOUT_MS || "8000", 10)
  const genRetry = parseInt(process.env.GEN_RETRY || "2", 10)
  const genFailover = process.env.GEN_FAILOVER === "true"
  
  return {
    fal: {
      ok: falStatus.ok,
      latency_ms: falStatus.latency_ms,
      error: falStatus.error || null,
      configured: !!process.env.FAL_API_KEY,
    },
    runware: {
      ok: runwareStatus.ok,
      latency_ms: runwareStatus.latency_ms,
      error: runwareStatus.error || null,
      configured: !!process.env.RUNWARE_API_KEY,
      deprecated: true,
    },
    config: {
      primary: genProviderPrimary,
      weights: genProviderWeights,
      timeout_ms: genTimeoutMs,
      retry: genRetry,
      failover: genFailover,
    },
  }
}

/**
 * 检查权重 >0 的供应商是否可用
 * 如果任何非零供应商缺 Key 或不可用，返回 false
 */
async function checkProvidersAvailability(providersStatus: any): Promise<boolean> {
  const weights = providersStatus.config.weights
  
  // 检查 FAL
  if (weights.fal > 0) {
    if (!providersStatus.fal.configured) {
      console.warn(`FAL has weight ${weights.fal} but FAL_API_KEY is missing`)
      return false
    }
    if (!providersStatus.fal.ok) {
      console.warn(`FAL has weight ${weights.fal} but is not available: ${providersStatus.fal.error}`)
      return false
    }
  }
  
  // 检查 Runware
  if (weights.runware > 0) {
    if (!providersStatus.runware.configured) {
      console.warn(`Runware has weight ${weights.runware} but RUNWARE_API_KEY is missing`)
      return false
    }
    if (!providersStatus.runware.ok) {
      console.warn(`Runware has weight ${weights.runware} but is not available: ${providersStatus.runware.error}`)
      return false
    }
  }
  
  return true
}

/**
 * 獲取 Settings 診斷信息
 */
async function getSettingsDiagnostics() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  const falApiKey = process.env.FAL_API_KEY
  const falModelId = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
  const modelProvider = useMock ? "mock" : (falApiKey ? "fal" : "degraded")
  const modelId = useMock ? null : (falApiKey ? falModelId : null)

  return {
    model_provider: modelProvider,
    model_id: modelId,
    use_mock: useMock,
    fal_configured: !!falApiKey,
    fal_model_id: falModelId,
  }
}

/**
 * 獲取 Runware 狀態（僅摘要）
 * @deprecated Runware 已弃用，请使用 FAL 替代
 */
async function getRunwareStatus() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  const isProduction = process.env.NODE_ENV === "production"
  const runwareApiKey = process.env.RUNWARE_API_KEY

  // Fail-Fast Gate: 如果 Production 且 USE_MOCK=false 且无 key，显示明确错误
  // 保留 Mock 降级只在 Preview 可用
  if (isProduction && !useMock && !runwareApiKey) {
    return {
      ok: false,
      latency_ms: null,
      error: "RUNWARE_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure RUNWARE_API_KEY.",
      status: "error",
    };
  }

  try {
    const health = await checkRunwareHealth()
    return {
      ok: health.ok,
      latency_ms: health.latency_ms,
      error: health.error || null,
      status: health.ok ? "ok" : "error",
    };
  } catch (error) {
    console.error("Runware status error:", error);
    return {
      ok: false,
      latency_ms: null,
      error: "Failed to check Runware health",
      status: "error",
    };
  }
}

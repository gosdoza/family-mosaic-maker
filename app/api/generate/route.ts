import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createMockJob } from "@/lib/generation/mock-state-machine"
import { routeGenerateRequest, ProviderGenerateRequest } from "@/lib/generation/provider-router"
import { RunwareGenerateRequest } from "@/lib/generation/runware-client"
import { validateRunwarePayload, RunwarePayload } from "@/lib/providers/runware.schema"
import { ZodError } from "zod"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"
import { isPreviewEnv, runwareMode } from "@/lib/featureFlags"

/**
 * Provider Decision Rules:
 * 
 * The provider is determined by the following logic (in order):
 * 1. If useReal checkbox is checked (useReal === true) AND
 *    RUNWARE_ENABLED === true AND
 *    template/style is supported (currently: christmas + realistic) → use Runware
 * 2. Otherwise → use Mock
 * 
 * Important: When Mock provider is selected, the request must NEVER call Runware
 * or consume credits. The Mock provider should always succeed in the normal case.
 * 
 * 主要流程：
 * 1. 認證檢查（測試環境可豁免）
 * 2. 記錄 gen_start 事件
 * 3. 檢查 Mock/Production 模式
 * 4. 解析請求體（FormData 或 JSON）
 * 5. 驗證輸入字段
 * 6. 調用 Provider Router（FAL/Runware）或 Mock
 * 7. 存儲 job 到資料庫
 * 8. 記錄 gen_ok 事件
 * 9. 返回 { ok: true, jobId, request_id }
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  let user: { id: string } | null = null
  
  try {
    // Check provider type (new system with backward compatibility)
    const providerType = getProviderType()
    const useMock = providerType === "mock"
    const isTestMode = process.env.NODE_ENV === "test" || useMock
    const allowTestLogin = process.env.ALLOW_TEST_LOGIN === "true"
    const isProduction = process.env.NODE_ENV === "production"
    
    // 检查是否有测试登录 cookie（来自 /api/test/login）
    // Supabase SSR 使用的 cookie 名称可能是 sb-<project-ref>-auth-token
    const allCookies = request.cookies.getAll()
    const hasTestCookie = allCookies.some(
      (c) =>
        c.name === "__e2e" ||
        c.name.startsWith("sb-") ||
        c.name.includes("auth-token") ||
        c.name.includes("access-token")
    )

    // 测试模式豁免：跳过登录检查
    // 条件：1) NODE_ENV=test 或 USE_MOCK=true 2) ALLOW_TEST_LOGIN=true 且有测试 cookie 或任何 Supabase cookie
    if (isTestMode || (allowTestLogin && hasTestCookie)) {
      console.log("[generate] mode=test-bypass-auth")
      user = { id: "test-user" }
    } else {
      // Get current user
      const supabase = await createClient()
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !currentUser) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized", request_id: requestId },
          { status: 401 }
        )
      }

      user = currentUser
    }

    // Fail-Fast Gate: 如果 Production 且 USE_MOCK=false 且无 FAL_API_KEY，返回 503
    // 保留 Mock 降级只在 Preview 可用
    const falApiKey = process.env.FAL_API_KEY
    const falModelId = process.env.FAL_MODEL_ID || "fal-ai/flux/schnell"
    const runwareApiKey = process.env.RUNWARE_API_KEY
    const runwareBaseUrl = process.env.RUNWARE_BASE_URL || "https://api.runware.ai"
    const modelProvider = useMock ? "mock" : (falApiKey ? "fal" : "degraded")
    const modelId = useMock ? null : (falApiKey ? falModelId : null)
    
    // 记录 gen_start 事件
    await logAnalyticsEvent({
      event_type: "gen_start",
      request_id: requestId,
      user_id: user.id,
      data: {
        model_provider: modelProvider,
        model_id: modelId,
      },
    })
    
    if (isProduction && !useMock && !falApiKey) {
      // 记录错误事件
      await logAnalyticsEvent({
        event_type: "gen_fail",
        request_id: requestId,
        user_id: user.id,
        error: "E_MODEL_MISCONFIG",
        data: {
          error_code: "E_MODEL_MISCONFIG",
          message: "FAL_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure FAL_API_KEY.",
        },
      })

      return NextResponse.json(
        {
          error: "E_MODEL_MISCONFIG",
          message: "FAL_API_KEY missing in production. Set NEXT_PUBLIC_USE_MOCK=true or configure FAL_API_KEY.",
          request_id: requestId,
        },
        { status: 503 }
      )
    }

    // 測試環境專用的穩定成功路徑（不影響 production）
    // 條件：NODE_ENV !== 'production' 且 ALLOW_TEST_LOGIN === 'true'
    // BUT: 如果設定了 NEXT_PUBLIC_FORCE_REAL_GENERATE=true 或 NEXT_PUBLIC_RUNWARE_MODE=real，則跳過此路徑
    const isTestModeForMock = 
      process.env.NODE_ENV !== 'production' && 
      process.env.ALLOW_TEST_LOGIN === 'true' &&
      process.env.NEXT_PUBLIC_FORCE_REAL_GENERATE !== 'true' &&
      runwareMode !== 'real'
    
    if (isTestModeForMock) {
      const mockJobId = 'test-job-001'
      const mockRequestId = 'test-req-generate-001'
      console.log('[generate] test-mode mock response', {
        jobId: mockJobId,
        request_id: mockRequestId,
        reason: 'ALLOW_TEST_LOGIN=true and not forcing real generate',
      })
      return NextResponse.json(
        {
          ok: true,
          provider: 'mock',
          jobId: mockJobId,
          request_id: mockRequestId,
          isFallback: false,
        },
        { status: 200 },
      )
    }
    
    // 使用 Provider 系統（Mock 或 Runware）
    let provider = getGenerationProvider() // Changed to let for reassignment
    
    // 解析請求（支援 FormData 或 JSON）
    let files: File[] = []
    let style: string = ""
    let template: string = ""
    let useReal: boolean = false // TASK 1: Per-request flag for real AI
    
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await request.formData()
        files = formData.getAll("files") as File[]
        style = (formData.get("style") as string) || ""
        template = (formData.get("template") as string) || ""
        // 修復：正確解析 FormData 中的 useReal（可能是 string 或 File）
        const useRealValue = formData.get("useReal")
        if (useRealValue !== null) {
          // FormData.get() 返回 FormDataEntryValue，可能是 string 或 File
          const useRealStr = typeof useRealValue === "string" ? useRealValue : useRealValue.name
          useReal = useRealStr === "true" || useRealStr === true
        } else {
          useReal = false
        }
        
        // Debug log
        if (process.env.NODE_ENV !== "production") {
          console.log("[api/generate] parsed FormData", {
            useRealValue,
            useRealStr: typeof useRealValue === "string" ? useRealValue : useRealValue.name,
            useReal,
            style,
            template,
            filesCount: files.length,
          })
        }
      } catch (error) {
        console.error("[api/generate] FormData parse error:", error)
        // 忽略解析錯誤，使用預設值
      }
    } else {
      try {
        const body = await request.json()
        files = (body.files || []) as File[]
        style = body.style || ""
        template = body.template || ""
        // 修復：正確解析 JSON body 中的 useReal
        useReal = body.useReal === true || body.useReal === "true"
        
        // Debug log
        if (process.env.NODE_ENV !== "production") {
          console.log("[api/generate] parsed JSON body", {
            useReal: body.useReal,
            useRealParsed: useReal,
            style,
            template,
            filesCount: files.length,
          })
        }
      } catch (error) {
        console.error("[api/generate] JSON parse error:", error)
        // 忽略解析錯誤，使用預設值
      }
    }
    
    // Route B: Real Runware API integration with fallback to mock
    // Priority: useReal checkbox → runware (if enabled), else → mock
    
    // Check if Runware is enabled and template/style is supported
    const isRunwareSupported = template === "christmas" && style === "realistic"
    // 總開關檢查：RUNWARE_ENABLED 必須為 true 才能使用 Runware
    const runwareEnabledFlag = process.env.RUNWARE_ENABLED !== "false" && process.env.RUNWARE_ENABLED !== "0"
    
    // 修復：Provider decision 邏輯
    // - 如果 useReal === true 且 RUNWARE_ENABLED === true 且 template/style 支援 → 使用 Runware
    // - 否則 → 使用 Mock
    // 不再依賴 runwareMode，直接根據 useReal checkbox 和 RUNWARE_ENABLED 決定
    let finalProviderName: "mock" | "runware" = "mock"
    
    if (useReal && runwareEnabledFlag && isRunwareSupported) {
      // 使用者勾選了 checkbox，且 Runware 已啟用，且 template/style 支援 → 使用 Runware
      finalProviderName = "runware"
      try {
        const { createRunwareProvider } = await import("@/lib/generation/providers/runware")
        provider = createRunwareProvider()
      } catch (error) {
        // 如果 RunwareProvider 創建失敗（例如缺少 API key），fallback 到 mock
        console.warn("[api/generate] Failed to create RunwareProvider, falling back to mock:", error)
        finalProviderName = "mock"
        const { createMockProvider } = await import("@/lib/generation/providers/mock")
        provider = createMockProvider()
      }
    } else {
      // 使用 Mock Provider
      finalProviderName = "mock"
      if (provider.name !== "mock") {
        const { createMockProvider } = await import("@/lib/generation/providers/mock")
        provider = createMockProvider()
      }
    }
    
    // 修復：isRunwareEnabled 應該基於最終決定的 provider
    const isRunwareEnabled = finalProviderName === "runware" && runwareEnabledFlag && useReal && isRunwareSupported
    
    // Log provider decision (dev only)
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/generate] provider decision", {
        providerName: finalProviderName,
        useRealFromRequest: useReal,
        runwareEnabledFlag,
        isRunwareSupported,
        isRunwareEnabled,
        template,
        style,
        envRunwareEnabled: process.env.RUNWARE_ENABLED,
        envNextPublicRunwareEnabled: process.env.NEXT_PUBLIC_RUNWARE_ENABLED,
      })
    }
    
    // Track if we attempted Runware (for isFallback calculation)
    let attemptedRunware = false
    
    // Try Runware first if enabled and supported
    if (isRunwareEnabled) {
      attemptedRunware = true
      try {
        const fileUrls = await getFileUrls(files, user.id)
        // 將 userId 傳入 payload（provider 可能需要）
        const payload = { files: fileUrls, style, template, userId: user.id, requestId }
        const { jobId } = await provider.generate(payload)
        
        // 记录 gen_ok 事件（Runware 模式）
        await logAnalyticsEvent({
          event_type: "gen_ok",
          request_id: requestId,
          user_id: user.id,
          data: {
            job_id: jobId,
            mode: "runware",
            model_provider: "runware",
            model_id: null,
            template,
            style,
          },
        })

        return NextResponse.json({ 
          ok: true, 
          jobId, 
          request_id: requestId,
          provider: "runware",
          isFallback: false,
        })
      } catch (error: any) {
        // 如果錯誤是 RUNWARE_DISABLED，直接 fallback 到 mock，不要重試 Runware
        if (error?.message === "RUNWARE_DISABLED" || error?.name === "RunwareDisabledError") {
          console.log("[api/generate] RUNWARE_DISABLED, fallback to mock provider")
          // Fall through to mock provider below
        } else {
          // RUNWARE-NOTE: If RunwareProvider fails, fallback to mock
          console.error("[api/generate] RunwareProvider failed, falling back to mock:", {
            error: error.message,
            status: error.status,
            name: error.name,
            stack: error.stack,
          })
          
          // Log fallback event
          await logAnalyticsEvent({
            event_type: "gen_fail",
            request_id: requestId,
            user_id: user.id,
            error: "RUNWARE_FALLBACK",
            data: {
              error_message: error.message,
              error_status: error.status,
              template,
              style,
              fallback_to: "mock",
            },
          })
        }
        
        // Fall through to mock provider below
      }
    }

    // Use Mock Provider for all other cases:
    // - useReal checkbox is unchecked
    // - Runware not enabled
    // - Template/style not supported
    // - Runware failed (fallback)
    // Ensure we use the mock provider that was already determined above
    const fileUrls = files.map(f => (f instanceof File ? f.name : String(f)) || "")
    
    // Use the provider we already determined (should be mock at this point)
    // Mock provider.generate() should never throw in normal cases
    let jobId: string
    try {
      const result = await provider.generate({ files: fileUrls, style, template })
      if (!result.ok || !result.jobId) {
        throw new Error("Mock provider.generate() returned invalid result")
      }
      jobId = result.jobId
    } catch (error: any) {
      // This should never happen for Mock provider, but handle gracefully
      console.error("[api/generate] Mock provider.generate() failed:", {
        request_id: requestId,
        provider: provider.name,
        error: error.message,
        stack: error.stack,
      })
      throw new Error(`Mock generation failed: ${error.message || "Unknown error"}`)
    }
    
    // Determine if this is a fallback from Runware
    // isFallback is true only if we tried Runware first (attemptedRunware === true) but it failed
    const isFallback = attemptedRunware && finalProviderName === "mock"
    const fallbackReason = attemptedRunware ? "runware_failed" : undefined
    
    // 记录 gen_ok 事件（Mock 模式）
    await logAnalyticsEvent({
      event_type: "gen_ok",
      request_id: requestId,
      user_id: user.id,
      data: {
        job_id: jobId,
        mode: "mock",
        model_provider: "mock",
        model_id: null,
        template,
        style,
        fallback_reason: fallbackReason,
        is_fallback: isFallback,
      },
    })

    return NextResponse.json({ 
      ok: true, 
      jobId, 
      request_id: requestId,
      provider: "mock",
      isFallback: isFallback || false,
    })
  } catch (error: any) {
    const isDev = process.env.NODE_ENV !== "production"
    
    // Enhanced error logging: Always log request_id, provider name, and error details
    // This helps correlate errors with the JSON response
    console.error("[api/generate] Error caught in outer try-catch:", {
      request_id: requestId,
      provider: finalProviderName || "unknown",
      useRealFromRequest: useReal,
      error_name: error.name || "Error",
      error_message: error.message || "Unknown error",
      error_stack: error.stack,
      error_status: error.status,
      error_code: error.code,
      // Additional Runware-specific error fields
      responseBody: error.responseBody,
      responseBodyText: error.responseBodyText,
      xRequestId: error.xRequestId,
      originalError: error.originalError,
      cause: error.cause,
    })
    
    // 记录错误事件
    await logAnalyticsEvent({
      event_type: "gen_fail",
      request_id: requestId,
      user_id: user?.id || null,
      error: error.name || "internal_error",
      data: { 
        message: error.message || "Unknown error",
        status: error.status,
        code: error.code,
        provider: finalProviderName || "unknown",
        useReal,
      },
    })

    // 構建錯誤回應
    // This 500 response is triggered when:
    // - provider.generate() throws an unexpected error
    // - Request parsing fails (FormData/JSON)
    // - Analytics logging fails (unlikely, as it's wrapped in try-catch)
    // - Any other unexpected error in the handler
    const basePayload: any = {
      error: "Failed to process generation request",
      request_id: requestId,
    }

    // 在 dev 環境下，添加 debug 資訊
    if (isDev) {
      basePayload.debug = {
        source: error.name === "RunwareGenerateError" ? "runware" : 
                finalProviderName === "mock" ? "mock" : "unknown",
        code: error.code || "INTERNAL_ERROR",
        name: error.name || "Error",
        message: error.message || "Unknown error",
        status: error.status,
        statusText: error.statusText,
        // 如果有 response body，也包含進來（但限制長度）
        responseBody: error.responseBody 
          ? (typeof error.responseBody === "string" 
              ? error.responseBody.substring(0, 500)
              : JSON.stringify(error.responseBody).substring(0, 500))
          : undefined,
        xRequestId: error.xRequestId,
      }
    }

    return NextResponse.json(basePayload, { status: 500 })
  }
}

/**
 * 获取文件 URL（从 Supabase Storage）
 */
async function getFileUrls(files: File[], userId: string): Promise<string[]> {
  // 如果 files 已经是 URL 字符串数组，直接返回
  if (files.length > 0 && typeof files[0] === "string") {
    return files as unknown as string[]
  }
  
  // 这里返回占位符 URL（实际应从 Supabase Storage 获取签名 URL）
  return (files as File[]).map((file) => `https://storage.example.com/${userId}/${file.name}`)
}

/**
 * 记录 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  request_id: string
  user_id: string | null
  error?: string
  data?: any
}) {
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

    await serviceClient.from("analytics_logs").insert({
      event_type: event.event_type,
      event_data: {
        request_id: event.request_id,
        error: event.error,
        ...event.data,
      },
      user_id: event.user_id,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to log analytics event:", error)
    // 不抛出错误，避免影响主流程
  }
}


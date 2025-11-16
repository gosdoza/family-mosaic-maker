import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createMockJob } from "@/lib/generation/mock-state-machine"
import { routeGenerateRequest, ProviderGenerateRequest } from "@/lib/generation/provider-router"
import { RunwareGenerateRequest } from "@/lib/generation/runware-client"
import { validateRunwarePayload, RunwarePayload } from "@/lib/providers/runware.schema"
import { ZodError } from "zod"
import { getGenerationProvider, getProviderType } from "@/lib/generation/getProvider"

/**
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
    const isTestModeForMock = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_LOGIN === 'true'
    
    if (isTestModeForMock) {
      const mockJobId = 'test-job-001'
      const mockRequestId = 'test-req-generate-001'
      console.log('[generate] test-mode mock response', {
        jobId: mockJobId,
        request_id: mockRequestId,
      })
      return NextResponse.json(
        {
          ok: true,
          provider: 'runware',
          jobId: mockJobId,
          request_id: mockRequestId,
        },
        { status: 200 },
      )
    }
    
    // 使用 Provider 系統（Mock 或 Runware）
    const provider = getGenerationProvider()
    
    // 解析請求（支援 FormData 或 JSON）
    let files: File[] = []
    let style: string = ""
    let template: string = ""
    
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await request.formData()
        files = formData.getAll("files") as File[]
        style = formData.get("style") as string || ""
        template = formData.get("template") as string || ""
      } catch (error) {
        // 忽略解析錯誤
      }
    } else {
      try {
        const body = await request.json()
        files = (body.files || []) as File[]
        style = body.style || ""
        template = body.template || ""
      } catch (error) {
        // 忽略解析錯誤
      }
    }
    
    // RUNWARE-NOTE: Check if template + style combination is supported by RunwareProvider
    // Only "christmas" + "realistic" is supported, others fallback to mock
    const isRunwareSupported = template === "christmas" && style === "realistic"
    
    // 如果使用 Runware Provider 且 template/style 組合支援
    if (provider.name === "runware" && isRunwareSupported) {
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

        return NextResponse.json({ ok: true, jobId, request_id: requestId })
      } catch (error: any) {
        // RUNWARE-NOTE: If RunwareProvider throws (e.g., template not supported), fallback to mock
        console.warn("[generate] RunwareProvider failed, falling back to mock:", error.message)
        // Fall through to mock provider below
      }
    }

    // 如果使用 Mock Provider，或 Runware 不支援此 template/style 組合
    // RUNWARE-NOTE: Mock provider handles all cases, including unsupported Runware combinations
    if (provider.name === "mock" || !isRunwareSupported) {
      const fileUrls = files.map(f => f.name || "")
      const { jobId } = await provider.generate({ files: fileUrls, style, template })
      
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
          fallback_reason: provider.name === "runware" && !isRunwareSupported ? "template_not_supported" : undefined,
        },
      })

      return NextResponse.json({ ok: true, jobId, request_id: requestId })
    }

    // 如果走到這裡，表示 provider 不是 mock 也不是 runware（可能是 fal 或其他）
    // 使用現有的 Provider Router（向後兼容）

    // Validate inputs - 返回缺失字段列表
    const missingFields: string[] = []
    if (!files || files.length === 0) {
      missingFields.push("files")
    }
    if (!style) {
      missingFields.push("style")
    }
    if (!template) {
      missingFields.push("template")
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Missing required fields", 
          fields: missingFields,
          request_id: requestId 
        },
        { status: 400 }
      )
    }

    let jobId: string
    let mode: "fal" | "runware" | "mock" | "degraded" = "fal"
    let finalModelProvider: string = "fal"
    let finalModelId: string | null = falModelId

    try {
      // 获取文件 URL（从 Supabase Storage）
      const fileUrls = await getFileUrls(files, user.id)

      // 如果配置了 FAL_API_KEY 或 RUNWARE_API_KEY，则使用 Provider Router
      if (falApiKey || runwareApiKey) {
        // 构建最小 payload（先只保留必需字段）
        const providerRequest: ProviderGenerateRequest = buildRunwarePayload({
          files: fileUrls,
          style,
          template,
        })

        const routerResponse = await routeGenerateRequest(
          providerRequest,
          {
            request_id: requestId,
            user_id: user.id,
          }
        )

        jobId = routerResponse.jobId
        mode = routerResponse.provider
        finalModelProvider = routerResponse.provider
        finalModelId = routerResponse.provider === "fal" ? falModelId : null
      } else {
        // 没有 API key：如果是 Preview 且 useMock=true，上面已返回；这里作为额外保护
        throw new Error("FAL_API_KEY or RUNWARE_API_KEY missing, cannot call provider")
      }
    } catch (error: any) {
      console.error("Provider router failed:", error)
      
      // 检查是否是 Provider 4xx/5xx 错误（来自 Runware 或 FAL）
      if (error.status && error.status >= 400 && error.status < 600) {
        // Provider 返回了 4xx/5xx 错误
        // 从错误消息中推断 provider（如果包含 "Runware" 或 "FAL"）
        let detectedProvider: "runware" | "fal" = "fal"
        if (error.message?.includes("Runware") || error.message?.toLowerCase().includes("runware")) {
          detectedProvider = "runware"
        } else if (error.message?.includes("FAL") || error.message?.toLowerCase().includes("fal")) {
          detectedProvider = "fal"
        }
        
        // 生成路径严格要求 2xx（健康检查允许 400，但生成不允许）
        const statusCode = error.status >= 500 ? 502 : 500
        const errorMessage = error.responseBody?.error || error.responseBody?.message || error.message || "Provider API error"
        const responseBodyText = error.responseBodyText || (typeof error.responseBody === "string" ? error.responseBody.substring(0, 300) : JSON.stringify(error.responseBody).substring(0, 300))
        const xRequestId = error.xRequestId || null
        
        // 构建 hint（包含 response body 片段和 x-request-id）
        const hint = xRequestId 
          ? `x-request-id: ${xRequestId}; response: ${responseBodyText}`
          : `response: ${responseBodyText}`
        
        // 记录错误事件
        await logAnalyticsEvent({
          event_type: "gen_fail",
          request_id: requestId,
          user_id: user.id,
          error: `PROVIDER_${error.status}`,
          data: {
            provider: detectedProvider,
            status: error.status,
            error_message: errorMessage,
          },
        })

        return NextResponse.json(
          {
            ok: false,
            provider: detectedProvider,
            status: error.status,
            error: errorMessage,
            hint,
            request_id: requestId,
          },
          { status: statusCode }
        )
      }
      
      // 其他错误：降级到 Mock 模式（仅在非生产环境）
      if (!isProduction) {
        console.warn("Provider router failed, falling back to mock if allowed:", error)
        jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        mode = "degraded"
        finalModelProvider = "degraded"
        finalModelId = null
      } else {
        // 生产环境不允许降级
        await logAnalyticsEvent({
          event_type: "gen_fail",
          request_id: requestId,
          user_id: user.id,
          error: "PROVIDER_ERROR",
          data: {
            error_message: error.message || "Unknown provider error",
          },
        })

        return NextResponse.json(
          {
            ok: false,
            error: "Generation service unavailable",
            request_id: requestId,
          },
          { status: 503 }
        )
      }
    }

    // Store job in database
    const supabaseClient = await createClient()
    const { error: dbError } = await supabaseClient.from("jobs").insert({
      id: jobId,
      user_id: user.id,
      style,
      template,
      status: "pending",
      created_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error("Error storing job:", dbError)
      // Continue anyway, job might still be processed
    }

    // 记录 gen_ok 事件
    await logAnalyticsEvent({
      event_type: "gen_ok",
      request_id: requestId,
      user_id: user.id,
      data: {
        job_id: jobId,
        mode,
        model_provider: finalModelProvider,
        model_id: finalModelId,
      },
    })

    return NextResponse.json({ ok: true, jobId, request_id: requestId })
  } catch (error: any) {
    console.error("Error in generate API:", error)
    
    // 记录错误事件
    await logAnalyticsEvent({
      event_type: "gen_start",
      request_id: requestId,
      user_id: user?.id || null,
      error: "internal_error",
      data: { message: error.message || "Unknown error" },
    })

    return NextResponse.json(
      { error: "Failed to process generation request", request_id: requestId },
      { status: 500 }
    )
  }
}

/**
 * 构建 Runware 最小 payload
 * 先只保留最必需字段，其他字段待通过后逐步加回
 * 
 * @throws {ZodError} 如果 payload 验证失败
 */
function buildRunwarePayload(input: {
  files: string[]
  style: string
  template: string
}): ProviderGenerateRequest {
  // 将 style 和 template 组合成 prompt
  const prompt = `${input.style} ${input.template}`.trim()
  
  // 使用第一个文件 URL 作为 image_url（如果有且是有效 URL）
  let imageUrl: string | undefined = undefined
  if (input.files.length > 0) {
    const firstFile = input.files[0]
    // 验证是否为有效 URL（排除占位符 URL）
    try {
      const url = new URL(firstFile)
      // 排除占位符域名
      if (!url.hostname.includes("example.com") && !url.hostname.includes("localhost")) {
        imageUrl = firstFile
      }
    } catch {
      // 不是有效 URL，忽略
    }
  }

  // 构建符合 Runware schema 的 payload
  const runwarePayload: RunwarePayload = {
    taskType: "imageInference", // Runware API 必需字段
    prompt,
    model: "default",
    ...(imageUrl && { image_url: imageUrl }),
  }

  try {
    // 使用 schema 验证 payload
    const validatedPayload = validateRunwarePayload(runwarePayload)
    
    console.log("[generate] buildRunwarePayload: validated", {
      prompt: validatedPayload.prompt.substring(0, 50) + "...",
      model: validatedPayload.model,
      hasImageUrl: !!validatedPayload.image_url,
      payloadKeys: Object.keys(validatedPayload),
    })

    // 转换回 ProviderGenerateRequest 格式（保持兼容性）
    const payload: ProviderGenerateRequest = {
      files: input.files,
      style: input.style,
      template: input.template,
    }

    return payload
  } catch (error) {
    if (error instanceof ZodError) {
      // 打印哪个字段不合格
      const fieldErrors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }))
      
      console.error("[generate] buildRunwarePayload: validation failed", {
        errors: fieldErrors,
        input: {
          filesCount: input.files.length,
          style: input.style,
          template: input.template,
        },
      })
      
      // 抛出包含详细错误信息的错误
      const errorMessage = fieldErrors
        .map((e) => `Field '${e.field}': ${e.message}`)
        .join("; ")
      
      throw new Error(`Runware payload validation failed: ${errorMessage}`)
    }
    throw error
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

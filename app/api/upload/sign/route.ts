import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 限制配置
const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8MB
const MAX_BATCH_SIZE = 5 // 单批最多 5 张
const MAX_BATCHES_PER_10MIN = 2 // 10 分钟内最多 2 批
const BATCH_WINDOW_MS = 10 * 60 * 1000 // 10 分钟（毫秒）

/**
 * POST /api/upload/sign
 * 
 * 签名上传 API：仅登入可取签名
 * 限制：单张 ≤8MB、单批 ≤5、10 分钟 ≤2 批
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      // 记录 upload_start 事件（未登入）
      await logAnalyticsEvent({
        event_type: "upload_start",
        request_id: requestId,
        user_id: null,
        error: "unauthorized",
      })

      return NextResponse.json(
        { error: "Unauthorized", request_id: requestId },
        { status: 401 }
      )
    }

    // 2. 解析请求体
    const body = await request.json()
    const { files } = body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided", request_id: requestId },
        { status: 400 }
      )
    }

    // 3. 验证文件数量（单批 ≤5）
    if (files.length > MAX_BATCH_SIZE) {
      await logAnalyticsEvent({
        event_type: "upload_rate_limited",
        request_id: requestId,
        user_id: user.id,
        error: "batch_size_exceeded",
        data: { batch_size: files.length, max_batch_size: MAX_BATCH_SIZE },
      })

      return NextResponse.json(
        {
          error: `Batch size exceeds limit. Maximum ${MAX_BATCH_SIZE} files per batch.`,
          request_id: requestId,
        },
        { status: 400 }
      )
    }

    // 4. 验证文件大小（单张 ≤8MB）
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        await logAnalyticsEvent({
          event_type: "upload_rate_limited",
          request_id: requestId,
          user_id: user.id,
          error: "file_size_exceeded",
          data: { file_name: file.name, file_size: file.size, max_size: MAX_FILE_SIZE },
        })

        return NextResponse.json(
          {
            error: `File ${file.name} exceeds size limit. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB per file.`,
            request_id: requestId,
          },
          { status: 400 }
        )
      }
    }

    // 5. 检查 rate limit（10 分钟内 ≤2 批）
    const rateLimitCheck = await checkRateLimit(user.id)
    if (!rateLimitCheck.allowed) {
      const retryAfter = Math.ceil(rateLimitCheck.retryAfter / 1000) // 转换为秒

      await logAnalyticsEvent({
        event_type: "upload_rate_limited",
        request_id: requestId,
        user_id: user.id,
        error: "rate_limit_exceeded",
        data: {
          batches_in_window: rateLimitCheck.batchesInWindow,
          max_batches: MAX_BATCHES_PER_10MIN,
          retry_after: retryAfter,
        },
      })

      return NextResponse.json(
        {
          error: "Rate limit exceeded. Too many batches in 10 minutes.",
          request_id: requestId,
          retry_after: retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
        }
      )
    }

    // 6. 记录 upload_start 事件
    await logAnalyticsEvent({
      event_type: "upload_start",
      request_id: requestId,
      user_id: user.id,
      data: { file_count: files.length },
    })

    // 7. 生成签名 URL
    const signedUrls = []
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

    for (const file of files) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`
      
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from("originals")
        .createSignedUploadUrl(filePath, {
          upsert: false,
        })

      if (signedUrlError || !signedUrlData) {
        console.error("Failed to generate signed URL:", signedUrlError)
        continue
      }

      signedUrls.push({
        file_name: file.name,
        file_path: filePath,
        signed_url: signedUrlData.signedUrl,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 分钟有效期
      })
    }

    if (signedUrls.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate signed URLs", request_id: requestId },
        { status: 500 }
      )
    }

    // 8. 记录 upload_ok 事件
    await logAnalyticsEvent({
      event_type: "upload_ok",
      request_id: requestId,
      user_id: user.id,
      data: {
        file_count: signedUrls.length,
        signed_urls: signedUrls.map((url) => ({
          file_name: url.file_name,
          file_path: url.file_path,
        })),
      },
    })

    return NextResponse.json({
      success: true,
      request_id: requestId,
      signed_urls: signedUrls,
    })
  } catch (error: any) {
    console.error("Upload sign error:", error)
    
    // 记录错误事件
    await logAnalyticsEvent({
      event_type: "upload_start",
      request_id: requestId,
      user_id: null,
      error: "internal_error",
      data: { message: error.message },
    })

    return NextResponse.json(
      { error: "Internal server error", request_id: requestId },
      { status: 500 }
    )
  }
}

/**
 * 检查 rate limit
 */
async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  batchesInWindow: number
  retryAfter: number
}> {
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

    const windowStart = new Date(Date.now() - BATCH_WINDOW_MS)

    // 查询最近 10 分钟内的 upload_ok 事件
    const { data, error } = await serviceClient
      .from("analytics_logs")
      .select("created_at")
      .eq("user_id", userId)
      .eq("event_type", "upload_ok")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Rate limit check error:", error)
      // 出错时允许通过（fail open）
      return { allowed: true, batchesInWindow: 0, retryAfter: 0 }
    }

    const batchesInWindow = data?.length || 0
    const allowed = batchesInWindow < MAX_BATCHES_PER_10MIN

    // 计算 retry after（如果超过限制，返回最早一批的过期时间）
    let retryAfter = 0
    if (!allowed && data && data.length > 0) {
      const oldestBatch = new Date(data[data.length - 1].created_at)
      const windowEnd = new Date(oldestBatch.getTime() + BATCH_WINDOW_MS)
      retryAfter = Math.max(0, windowEnd.getTime() - Date.now())
    }

    return { allowed, batchesInWindow, retryAfter }
  } catch (error) {
    console.error("Rate limit check error:", error)
    // 出错时允许通过（fail open）
    return { allowed: true, batchesInWindow: 0, retryAfter: 0 }
  }
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




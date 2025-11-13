import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import sharp from "sharp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREVIEW_SIZE = 1024 // 1024px
const WATERMARK_OPACITY = 0.3 // 半透明水印

/**
 * POST /api/upload/preview
 * 
 * 1024 预览生成：清除 EXIF、叠半透明水印、存 previews
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 2. 解析请求体
    const body = await request.json()
    const { file_path, original_file_name, request_id } = body

    if (!request_id) {
      return NextResponse.json(
        { error: "request_id is required" },
        { status: 400 }
      )
    }

    if (!file_path) {
      return NextResponse.json(
        { error: "file_path is required", request_id },
        { status: 400 }
      )
    }

    // 3. 从 originals bucket 下载原图
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

    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("originals")
      .download(file_path)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download original file", request_id },
        { status: 500 }
      )
    }

    // 4. 读取文件为 Buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 5. 使用 sharp 处理图片
    // - 清除 EXIF（通过重新编码）
    // - 调整大小到 1024px（保持宽高比）
    // - 添加半透明水印
    let processedImage = sharp(buffer)
      .resize(PREVIEW_SIZE, PREVIEW_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })

    // 6. 获取图片元数据以确定输出格式
    const metadata = await processedImage.metadata()
    const isPng = metadata.format === "png"

    // 7. 创建水印（半透明文字）
    const watermarkSvg = `
      <svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">
        <text
          x="10"
          y="35"
          font-family="Arial, sans-serif"
          font-size="20"
          fill="rgba(255, 255, 255, ${WATERMARK_OPACITY})"
          font-weight="bold"
        >
          Family Mosaic
        </text>
      </svg>
    `

    const watermarkBuffer = Buffer.from(watermarkSvg)

    // 8. 叠加水印（右下角，不遮脸）
    const watermarkX = (metadata.width || PREVIEW_SIZE) - 210 // 右下角
    const watermarkY = (metadata.height || PREVIEW_SIZE) - 60

    processedImage = processedImage.composite([
      {
        input: watermarkBuffer,
        top: watermarkY,
        left: watermarkX,
        blend: "over",
      },
    ])

    // 9. 生成预览图 Buffer（清除 EXIF）
    const previewBuffer = isPng
      ? await processedImage.png({ quality: 85 }).toBuffer()
      : await processedImage.jpeg({ quality: 85, mozjpeg: true }).toBuffer()

    // 10. 上传预览图到 previews bucket
    const previewPath = `${user.id}/${Date.now()}_preview_${original_file_name || "preview.jpg"}`
    const contentType = isPng ? "image/png" : "image/jpeg"
    
    const { error: uploadError } = await serviceClient.storage
      .from("previews")
      .upload(previewPath, previewBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload preview", request_id },
        { status: 500 }
      )
    }

    // 11. 生成预览图的签名下载 URL（10 分钟有效期）
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("previews")
      .createSignedUrl(previewPath, 10 * 60) // 10 分钟

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: "Failed to generate preview URL", request_id },
        { status: 500 }
      )
    }

    // 12. 记录 preview_view 事件
    await logAnalyticsEvent({
      event_type: "preview_view",
      request_id,
      user_id: user.id,
      data: {
        original_file_path: file_path,
        preview_file_path: previewPath,
        preview_size: PREVIEW_SIZE,
      },
    })

    return NextResponse.json({
      success: true,
      request_id,
      preview_url: signedUrlData.signedUrl,
      preview_path: previewPath,
    })
  } catch (error: any) {
    console.error("Preview generation error:", error)
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * 记录 analytics_logs 事件
 */
async function logAnalyticsEvent(event: {
  event_type: string
  request_id: string
  user_id: string
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


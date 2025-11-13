import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getPayPalOrder, mapPayPalStatusToInternal } from "@/lib/paypal/client"
import { capturePayPalOrder } from "@/lib/paypal/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/paypal/confirm
 * 
 * PayPal 支付确认回调
 * 用户从 PayPal 返回后调用此端点确认支付状态
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")
    const jobId = searchParams.get("jobId") || searchParams.get("job_id")

    if (!token) {
      return NextResponse.redirect(new URL("/results?error=missing_token", request.url))
    }

    if (!jobId) {
      return NextResponse.redirect(new URL("/results?error=missing_job", request.url))
    }

    // 1. 获取 PayPal 订单详情
    const paypalOrder = await getPayPalOrder(token)

    // 2. 映射状态
    const internalStatus = mapPayPalStatusToInternal(paypalOrder.status)

    // 3. 如果订单已批准但未捕获，尝试捕获
    if (paypalOrder.status === "APPROVED") {
      try {
        await capturePayPalOrder(token)
        // 捕获成功，状态会变为 COMPLETED
        // 等待 Webhook 更新订单状态
      } catch (error) {
        console.error("Failed to capture order:", error)
        // 继续处理，Webhook 会处理捕获
      }
    }

    // 4. 重定向到结果页面
    const redirectUrl = new URL(`/results/${jobId}`, request.url)
    if (internalStatus === "paid") {
      redirectUrl.searchParams.set("paid", "1")
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    console.error("Error in PayPal confirm API:", error)
    return NextResponse.redirect(new URL("/results?error=confirm_failed", request.url))
  }
}




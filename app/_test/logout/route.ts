import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * 测试登出端点（仅用于 E2E 测试）
 * 
 * 安全要求：
 * - 仅在 NODE_ENV !== "production" 时可用
 * - 需要设置 ALLOW_TEST_LOGIN=true 环境变量
 */
export async function POST(request: NextRequest) {
  // 安全检查
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Test logout endpoint is not available in production" },
      { status: 403 }
    )
  }

  if (process.env.ALLOW_TEST_LOGIN !== "true") {
    return NextResponse.json(
      { error: "Test logout is not enabled. Set ALLOW_TEST_LOGIN=true to enable." },
      { status: 403 }
    )
  }

  try {
    const cookieStore = await cookies()
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    })

    // 清除 Supabase session cookies
    cookieStore.delete("sb-access-token")
    cookieStore.delete("sb-refresh-token")
    cookieStore.delete("sb-auth-token")

    return response
  } catch (error: any) {
    console.error("Test logout error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}




import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
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
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (process.env.ALLOW_TEST_LOGIN !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, error: "Supabase configuration is missing" },
        { status: 500 }
      )
    }

    // 创建 server-side Supabase client（使用 cookies）
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore errors in Server Component context
          }
        },
      },
    })

    // 登出
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      return NextResponse.json(
        { ok: false, error: signOutError.message },
        { status: 500 }
      )
    }

    const response = NextResponse.json({ ok: true })

    // 清除所有 Supabase cookies
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie) => {
      if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
        response.cookies.delete(cookie.name)
      }
    })

    return response
  } catch (error: any) {
    console.error("Test logout error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}




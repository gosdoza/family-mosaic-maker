import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * 测试登录端点（仅用于 E2E 测试）
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
    const { email, password } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { ok: false, error: "Email is required" },
        { status: 400 }
      )
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

    // 尝试登录
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // 如果登录失败且错误是 "Invalid login credentials"，尝试创建用户
    if (signInError && signInError.message.includes("Invalid login credentials")) {
      if (!supabaseServiceKey) {
        return NextResponse.json(
          { ok: false, error: "Service role key required for user creation" },
          { status: 500 }
        )
      }

      // 使用 Service Role 创建用户
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError || !newUser.user) {
        return NextResponse.json(
          { ok: false, error: `Failed to create user: ${createError?.message || "Unknown error"}` },
          { status: 500 }
        )
      }

      // 用户创建成功后，再次尝试登录
      const { data: retrySignInData, error: retrySignInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (retrySignInError || !retrySignInData.user) {
        return NextResponse.json(
          { ok: false, error: `Failed to sign in after user creation: ${retrySignInError?.message || "Unknown error"}` },
          { status: 500 }
        )
      }

      // 创建响应并设置 cookies
      const response = NextResponse.json({
        ok: true,
        user: {
          id: retrySignInData.user.id,
          email: retrySignInData.user.email,
        },
      })

      // 确保 cookies 被设置到响应中
      const allCookies = cookieStore.getAll()
      allCookies.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        })
      })

      return response
    }

    // 如果登录失败但不是 "Invalid login credentials"
    if (signInError || !signInData.user) {
      return NextResponse.json(
        { ok: false, error: signInError?.message || "Failed to sign in" },
        { status: 401 }
      )
    }

    // 登录成功
    const response = NextResponse.json({
      ok: true,
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
      },
    })

    // 确保 cookies 被设置到响应中
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      })
    })

    return response
  } catch (error: any) {
    console.error("Test login error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

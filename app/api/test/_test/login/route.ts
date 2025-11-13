import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

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
    return NextResponse.json(
      { error: "Test login endpoint is not available in production" },
      { status: 403 }
    )
  }

  if (process.env.ALLOW_TEST_LOGIN !== "true") {
    return NextResponse.json(
      { error: "Test login is not enabled. Set ALLOW_TEST_LOGIN=true to enable." },
      { status: 403 }
    )
  }

  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase configuration is missing" },
        { status: 500 }
      )
    }

    // 使用 service role 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 查找或创建测试用户
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)

    let userId: string

    if (existingUser?.user) {
      userId = existingUser.user.id
    } else {
      // 创建新用户（如果不存在）
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password: "test-password-123", // 测试密码
      })

      if (createError || !newUser.user) {
        return NextResponse.json(
          { error: `Failed to create user: ${createError?.message || "Unknown error"}` },
          { status: 500 }
        )
      }

      userId = newUser.user.id
    }

    // 创建 session
    const { data: session, error: sessionError } = await supabase.auth.admin.createSession({
      userId,
    })

    if (sessionError || !session) {
      return NextResponse.json(
        { error: `Failed to create session: ${sessionError?.message || "Unknown error"}` },
        { status: 500 }
      )
    }

    // 创建响应
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
      },
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
      },
    })

    // 使用 Supabase SSR 客户端设置 cookies
    const supabaseClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // 设置 session
    await supabaseClient.auth.setSession({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    })

    return response
  } catch (error: any) {
    console.error("Test login error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

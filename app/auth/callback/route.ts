import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * Supabase PKCE Email Link 回调处理
 * 
 * 重要：此 route 永遠只回傳 redirect，絕不回傳 JSON
 * 
 * 流程：
 * 1. 用户点击邮件中的链接，跳转到 /auth/callback?code=xxx
 * 2. Supabase SDK 在浏览器中自动存储 code_verifier 到 cookies
 * 3. 这个 server route 从 searchParams 读取 code，从 cookies 读取 code_verifier
 * 4. 调用 exchangeCodeForSession 交换 session
 * 5. 成功后重定向到 /dashboard 或指定的 redirect 参数
 * 6. 失败时重定向到 /auth/error 或 /auth/login
 * 
 * 邊界情境處理（對應 Spec）：
 * - S1/S2: 無 code 或 code 無效/過期 → redirect /auth/error?error=invalid_link
 * - S4: 已登入訪 /auth/callback → Supabase 會處理，成功則更新 session 並 redirect /dashboard
 * - S5: PKCE cookie 缺失 → redirect /auth/error?reason=missing_pkce_cookie
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get("code")
  const redirectTo = requestUrl.searchParams.get("redirect") || "/dashboard"

  // 如果没有 code，重定向到登录页
  if (!code) {
    const loginUrl = new URL("/auth/login", requestUrl.origin)
    loginUrl.searchParams.set("error", "missing_code")
    return NextResponse.redirect(loginUrl, { status: 302 })
  }

  try {
    // 创建 Supabase server client（会自动从 cookies 读取 code_verifier）
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // 交换 code 为 session（Supabase SSR 会自动从 cookies 读取 code_verifier）
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // 如果交换失败，重定向到错误页面
    if (error) {
      console.error("Failed to exchange code for session:", error)
      const errorUrl = new URL("/auth/error", requestUrl.origin)
      
      // 特殊处理 PKCE cookie 缺失的情况
      if (error.message?.includes("both auth code and code verifier should be non-empty")) {
        errorUrl.searchParams.set("reason", "missing_pkce_cookie")
        return NextResponse.redirect(errorUrl, { status: 302 })
      } else {
        // 其他错误统一使用 invalid_link，不把原始错误信息写到 URL
        errorUrl.searchParams.set("error", "invalid_link")
        return NextResponse.redirect(errorUrl, { status: 302 })
      }
    }

    // 成功：重定向到目标页面
    const redirectUrl = new URL(redirectTo, requestUrl.origin)
    return NextResponse.redirect(redirectUrl, { status: 302 })
  } catch (err) {
    // 意外错误：重定向到错误页面
    console.error("Unexpected error in callback:", err)
    const errorUrl = new URL("/auth/error", requestUrl.origin)
    errorUrl.searchParams.set("error", "internal_error")
    return NextResponse.redirect(errorUrl, { status: 302 })
  }
}

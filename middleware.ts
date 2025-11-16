import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Protected routes that require authentication
// 注意：這些是頁面路由（page routes），不是 API 路由
// API 路由（/api/*）由各自的 route handler 內部處理認證
const PROTECTED_ROUTES = ["/orders", "/results", "/settings"]

// Public API routes that should never require authentication
// 這些路由應該永遠是公開的，用於健康檢查等用途
const PUBLIC_API_ROUTES = ["/api/version", "/api/health"]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ============================================
  // 白名單檢查：Public API Routes 永遠不需要認證
  // ============================================
  // 這些路由（如 /api/version）應該永遠是公開的，用於健康檢查等用途
  // 即使未來 middleware 配置改變，這些路由也不會被攔截
  if (PUBLIC_API_ROUTES.some((route) => pathname === route)) {
    const response = NextResponse.next()
    return addSecurityHeaders(response, request)
  }

  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

  // Dev-only: Allow E2E test cookie bypass for protected routes
  if (process.env.NODE_ENV !== "production") {
    const e2eCookie = request.cookies.get("__e2e")
    if (e2eCookie?.value === "1" || e2eCookie?.value === "true") {
      // Set a header that useAuth can check (optional, for server-side checks)
      const response = NextResponse.next()
      response.headers.set("x-e2e-auth", "true")
      response.headers.set("x-e2e-user-id", "e2e-user")
      return addSecurityHeaders(response, request)
    }
  }

  // ============================================
  // 受保護的頁面路由檢查
  // ============================================
  // 注意：這裡只檢查頁面路由（/orders, /results, /settings）
  // API 路由（/api/*）由各自的 route handler 內部處理認證
  // 目前受保護的路由：
  // - /orders - 訂單頁面
  // - /results - 結果頁面
  // - /settings - 設定頁面
  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))

  // TEMP: Allow unauthenticated access to /results/demo-001 for Route A mock demo.
  // TODO: remove this exception when real Runware integration is ready.
  const isResultsDemo = pathname === "/results/demo-001" || pathname.startsWith("/results/demo-001/")

  if (isProtectedRoute && !isMock) {
    // Route A exception: demo-001 免登录放行
    if (isResultsDemo) {
      const response = NextResponse.next()
      return addSecurityHeaders(response, request)
    }
    // In non-mock mode, check Supabase authentication
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              // Cookies will be set by the response
            },
          },
        }
      )

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Redirect to login if not authenticated (307 Temporary Redirect)
        const loginUrl = new URL("/auth/login", request.url)
        loginUrl.searchParams.set("redirect", pathname)
        const response = NextResponse.redirect(loginUrl, { status: 307 })
        return addSecurityHeaders(response, request)
      }
    } catch (error) {
      // If Supabase is not configured, allow access (for development)
      console.warn("Supabase auth check failed:", error)
    }
  }

  const response = NextResponse.next()
  return addSecurityHeaders(response, request)
}

/**
 * 添加安全头部（CSP、X-Frame-Options 等）
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.nextUrl.origin
  const isProduction = process.env.NODE_ENV === "production"

  // Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net",
    "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com https://www.google.com",
    "frame-ancestors 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ]

  // 在开发环境中允许更多来源
  if (!isProduction) {
    cspDirectives.push("connect-src 'self' http://localhost:* https://*.supabase.co")
  }

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "))

  // X-Frame-Options (允许 PayPal 嵌入)
  response.headers.set("X-Frame-Options", "SAMEORIGIN")

  // X-Content-Type-Options
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Referrer-Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions-Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  )

  return response
}

export const config = {
  matcher: [
    // ✅ 完全排除 API 與靜態資源
    // 注意：這個 matcher 會排除所有 /api/* 路由，所以 middleware 不會攔截 API 請求
    // 但是為了保險起見，我們在上面的白名單檢查中明確處理了 /api/version 等公開 API
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}


import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Protected routes that require authentication
const PROTECTED_ROUTES = ["/orders", "/results", "/settings"]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

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

  // Check if route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))

  if (isProtectedRoute && !isMock) {
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
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}


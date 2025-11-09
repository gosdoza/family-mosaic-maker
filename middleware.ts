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
      return response
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
        return NextResponse.redirect(loginUrl, { status: 307 })
      }
    } catch (error) {
      // If Supabase is not configured, allow access (for development)
      console.warn("Supabase auth check failed:", error)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // ✅ 完全排除 API 與靜態資源
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}


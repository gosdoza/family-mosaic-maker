import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { LoginClient } from "@/components/auth/login-client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

/**
 * Login Page - Server Component Wrapper
 * 
 * 行為：
 * - 如果已登入 → redirect 到 /dashboard（S3: 已登入的使用者再訪 /auth/login）
 * - 如果未登入 → 顯示登入表單（LoginClient component）
 */
export default async function LoginPage() {
  // 檢查是否已登入
  const user = await getCurrentUser()

  // 如果已登入，直接 redirect 到 dashboard
  if (user) {
    redirect("/dashboard")
  }

  // 未登入：顯示登入表單
  return (
    <>
      {/* DEBUG BANNER - 永遠顯示，用於確認部署 */}
      <div className="w-full bg-black text-yellow-300 text-center py-4 font-mono text-xl font-bold">
        *** DEBUG BUILD - LOGIN PAGE ***
      </div>
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <LoginClient />

          <div className="mt-8 pt-6 border-t border-border text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </>
  )
}

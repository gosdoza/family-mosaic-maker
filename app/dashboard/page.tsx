import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { isDemoMode, isPreviewEnv } from "@/lib/featureFlags"

export default async function DashboardPage() {
  // NOTE: In preview demo mode we allow anonymous visitors to see dashboard + mock orders (Route D)
  const demoMode = isDemoMode && isPreviewEnv

  // 使用 server-side 方式取得目前登入的使用者
  const user = await getCurrentUser()

  // 如果沒有 session，在非 demo 模式下直接 redirect 到登入頁
  if (!user && !demoMode) {
    redirect("/auth/login")
  }

  // 取得使用者 email（如果有的話），在 demo 模式下使用 fallback
  const email = user?.email || "Guest"

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <DashboardClient email={email} />
        </div>
      </main>

      <Footer />
    </div>
  )
}

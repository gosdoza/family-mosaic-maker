import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Home } from "lucide-react"

export default async function DashboardPage() {
  // 使用 server-side 方式取得目前登入的使用者
  const user = await getCurrentUser()

  // 如果沒有 session，直接 redirect 到登入頁
  if (!user) {
    redirect("/auth/login")
  }

  // 取得使用者 email（如果有的話）
  const email = user.email || "Unknown"

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <Card className="p-8 sm:p-12 glass">
            <CardHeader className="text-center space-y-4">
              <CardTitle className="text-3xl font-bold">
                Welcome back
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">Signed in as</p>
                <p className="text-lg font-semibold text-foreground break-all">
                  {email}
                </p>
              </div>

              <div className="pt-4">
                <Link href="/">
                  <Button size="lg" className="w-full rounded-full h-12 shadow-lg">
                    <Home className="w-5 h-5 mr-2" />
                    Back to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}


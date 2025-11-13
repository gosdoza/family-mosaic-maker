"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const reason = searchParams.get("reason")
  
  const getErrorMessage = () => {
    // 优先处理 reason 参数（用于特定的错误场景）
    if (reason === "missing_pkce_cookie") {
      return "驗證連結無法使用，請確認：寄信與點信使用同一個瀏覽器／同一個裝置，且不是用 Mail App 或 Outlook App 開啟。建議改用 Web 版信箱（例如 Gmail / Outlook Web）重新點擊連結。"
    }
    
    // 处理 error 参数（通用错误）
    switch (error) {
      case "missing_code":
        return "验证链接缺少必要的参数。请重新发送验证邮件。"
      case "invalid_link":
      case "expired_token":
        return "验证链接已失效或已过期。请重新发送验证邮件。"
      case "internal_error":
        return "服务器处理验证时发生错误。请稍后重试。"
      default:
        return "登入連結已失效，請回登入頁重新索取魔法連結。"
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <Card className="p-8 sm:p-12 glass">
            <div className="text-center space-y-6">
              {/* Error icon */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-destructive/20 blur-2xl rounded-full" />
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-2">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-bold mb-3 text-destructive">
                  Oops, 验证失败
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                  {getErrorMessage()}
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <Link href="/auth/login">
                  <Button size="lg" className="w-full rounded-full h-12 shadow-lg">
                    <Mail className="w-5 h-5 mr-2" />
                    回登入页重新寄信
                  </Button>
                </Link>

                <Link href="/">
                  <Button variant="outline" size="lg" className="w-full rounded-full h-12">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    返回首页
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}


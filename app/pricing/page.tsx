"use client"

import { Suspense } from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, X, Sparkles, Zap, Lock, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { IS_MOCK_CLIENT } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"
import { ErrorState } from "@/components/error-state"
import { trackMetric } from "@/lib/metrics"
import { t } from "@/lib/i18n-client"
import { isDemoMode } from "@/lib/featureFlags"

function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Route C: 支持 job 和 jobId 参数（向后兼容）
  const job = searchParams.get("job") || searchParams.get("jobId") || "demo-001"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // NOTE: behavior preserved, just using centralized feature flags
  const isMock = isDemoMode
  const canPay = Boolean(job) && !loading // do NOT gate on anything else in mock mode

  const handlePay = async () => {
    if (!job) return

    try {
      setLoading(true)
      setError(null)

      // 生成幂等性 Key
      const idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // use the unified mock/real checkout route
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ jobId: job, price: "2.99" }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        if (res.status === 409) {
          // 幂等性冲突：订单已存在
          const { orderId, approvalUrl } = errorData
          if (approvalUrl) {
            router.replace(approvalUrl)
            return
          }
          throw new Error("Order already exists")
        }
        throw new Error(errorData.error || "checkout_failed")
      }

      const { approvalUrl } = await res.json()

      // Track purchase success event (GA)
      trackMetric({ event: "purchase_success", jobId: job, metadata: { amount: "2.99", currency: "USD" } })

      // In mock mode, log mock redirect
      if (isMock) {
        console.log("Mock redirect:", approvalUrl)
      }

      // Show success toast
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully!",
      })

      // Redirect to the approval URL
      router.replace(approvalUrl)
    } catch (e) {
      console.error("checkout error", e)
      const errorMessage = e instanceof Error ? e.message : "An error occurred"
      setError(errorMessage)
      
      // Track payment failure
      trackMetric({ event: "payment_failed", metadata: { error: errorMessage } })
      
      // Show error toast
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    handlePay()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main
        {...(process.env.NODE_ENV !== "production" ? { "data-testid": "pricing-page" } : {})}
        className="flex-1 pt-24 pb-16"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-balance">
              {t("pricing.title")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              {t("pricing.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <Card className="p-8 sm:p-10 glass border-2 border-border" data-testid="tier-free">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("pricing.free")}</span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold mb-2">{t("pricing.tryItOut")}</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-bold">$0</span>
                    <span className="text-muted-foreground">{t("pricing.perPhoto")}</span>
                  </div>
                  <p className="text-muted-foreground">{t("pricing.perfectForTesting")}</p>
                </div>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>2 variations per generation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>All style presets</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <span className="font-medium">Low-resolution</span> downloads
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <span className="font-medium">Includes watermark</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">No commercial use</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Standard processing</span>
                  </li>
                </ul>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full text-lg h-14 bg-transparent"
                  disabled
                >
                  <Lock className="w-5 h-5 mr-2" />
                  PayPal Checkout (Disabled)
                </Button>
              </div>
            </Card>

            {/* Premium Tier */}
            <Card className="p-8 sm:p-10 glass border-2 relative overflow-hidden shadow-2xl border-primary/30" data-testid="tier-premium">
              {/* Gradient glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 -z-10" />

              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{t("pricing.mostPopular")}</span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold mb-2">{t("pricing.premium")}</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-bold">$2.99</span>
                    <span className="text-muted-foreground">{t("pricing.perPhoto")}</span>
                  </div>
                  <p className="text-muted-foreground">{t("pricing.professionalQuality")}</p>
                </div>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">4 high-quality variations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">All style presets</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">
                      <span className="text-primary">HD resolution</span> downloads
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">
                      <span className="text-primary">No watermark</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">
                      <span className="text-primary">Commercial usage rights</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">Priority processing</span>
                  </li>
                </ul>

                <Button
                  data-testid="btn-paypal"
                  size="lg"
                  className="w-full rounded-full text-lg h-14 shadow-lg hover:shadow-xl transition-all"
                  onClick={handlePay}
                  disabled={!canPay}
                  aria-label="Pay with PayPal"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                      <span>{t("cta.payWithPayPal")} - $2.99</span>
                    </>
                  )}
                </Button>

                {/* 价格文案：USD 結帳＋多語 */}
                <div className="mt-4 p-3 bg-muted/30 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">
                    {t("pricing.chargedInUSD")}
                  </p>
                </div>

                {error && (
                  <div className="text-center p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground mb-6">Secure checkout powered by</p>
            <div className="flex items-center justify-center gap-6">
              <div className="px-6 py-2 rounded-lg glass">
                <span className="font-semibold text-[#003087]">Pay</span>
                <span className="font-semibold text-[#009cde]">Pal</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function PricingCheckout() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}

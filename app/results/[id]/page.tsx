"use client"

import { Suspense } from "react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter, useParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import Image from "next/image"
import { Download, Loader2, Lock, Share2, Sparkles, Check, Gift } from "lucide-react"
import { useAuth } from "@/lib/useAuth"
import { useToast } from "@/hooks/use-toast"
import { ErrorState } from "@/components/error-state"
import { trackMetric } from "@/lib/metrics"
import { isDemoJob } from "@/lib/featureFlags"

type ResultImage = { id: number | string; url: string; thumbnail: string }

interface ResultsResponse {
  jobId: string
  images: ResultImage[]
  paymentStatus: "paid" | "unpaid" | "free"
  createdAt: string
  qualityScores?: {
    clip: number
    brisque: number
  }
  voucherIssued?: boolean
  provider?: "mock" | "runware"
  isMock?: boolean
  identityMode?: boolean
}

/**
 * 浮水印組件
 * 
 * 顯示條件：
 * - paymentStatus !== "paid" 或 isMock === true 時顯示斜向多行文字浮水印
 * - paymentStatus === "paid" 時只顯示右下角小 logo
 */
function WatermarkOverlay({ isPaid, isMock }: { isPaid: boolean; isMock?: boolean }) {
  // 已付款且非 mock：右下角小 logo
  if (isPaid && !isMock) {
    return (
      <div className="absolute bottom-4 right-4 pointer-events-none z-10">
        <div className="px-3 py-1.5 bg-black/30 backdrop-blur-sm rounded-md border border-white/10">
          <span className="text-xs font-medium text-white/70 select-none">
            FAMILY MOSAIC MAKER
          </span>
        </div>
      </div>
    )
  }

  // 未付款或 mock：斜向多行文字浮水印（透明度 0.2，讓使用者可以清楚看到圖片）
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* 多行斜向浮水印文字 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full">
          {/* 第一行 */}
          <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-20">
            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white select-none whitespace-nowrap">
              FAMILY MOSAIC MAKER
            </span>
          </div>
          {/* 第二行 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-20">
            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white select-none whitespace-nowrap">
              PREVIEW
            </span>
          </div>
          {/* 第三行 */}
          <div className="absolute top-3/4 left-3/4 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-20">
            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white select-none whitespace-nowrap">
              FAMILY MOSAIC MAKER
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultsContent() {
  const params = useParams<{ id?: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const fallbackId = searchParams.get("id") || "demo-001"
  const id = params?.id || fallbackId
  const isDemo = isDemoJob(id)
  const { user, loading: authLoading } = useAuth(!isDemo)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultsResponse | null>(null)
  const [hoveredId, setHoveredId] = useState<number | string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let abort = false

    if (!id) {
      setError("missing_job_id")
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const paidParam = searchParams.get("paid")
        const apiUrl = paidParam 
          ? `/api/results/${id}?paid=${paidParam}`
          : `/api/results/${id}`

        const res = await fetch(apiUrl, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        })

        if (!res.ok) throw new Error(`results_fetch_failed:${res.status}`)

        const data: ResultsResponse = await res.json()

        if (abort) return

        setResults(data)
        trackMetric({ event: "generate_succeeded", jobId: id })
      } catch (e: any) {
        if (!abort) {
          const errorMessage = e?.message || "unknown_error"
          setError(errorMessage)
          trackMetric({ event: "generate_failed", jobId: id, metadata: { error: errorMessage } })
        }
      } finally {
        if (!abort) setLoading(false)
      }
    })()

    return () => {
      abort = true
    }
  }, [id, searchParams])

  const isPaidQuery = searchParams.get("paid") === "1" || searchParams.get("paid") === "true"
  const isPaid = results?.paymentStatus === "paid" || isPaidQuery

  // 主圖片（第一張生成圖）
  const mainImage = results?.images?.[0]
  // 其他圖片（從第二張開始）
  const otherImages = results?.images?.slice(1) || []

  const handleDownloadHD = async (imageId: number | string) => {
    if (!isPaid) {
      toast({
        title: "Upgrade to Premium",
        description: "Download HD images by upgrading to our Premium plan.",
        variant: "default",
        action: (
          <Button
            variant="secondary"
            onClick={() => router.push(`/pricing?job=${id}`)}
            aria-label="Go to pricing page"
          >
            Go to Pricing
          </Button>
        ),
      })
      return
    }

    setDownloadingId(imageId)
    try {
      window.location.href = `/api/download?job=${id}&i=${imageId}`
      toast({
        title: "Download Started",
        description: "Your HD image download should begin shortly.",
      })
    } catch (err) {
      console.error("Error initiating download:", err)
      toast({
        title: "Download Failed",
        description: "Could not start download. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleShare = (image: ResultImage) => {
    if (navigator.share) {
      navigator
        .share({
          title: `My Family Mosaic - Job ${results?.jobId}`,
          text: "Check out my amazing family mosaic!",
          url: window.location.href,
        })
        .catch((error) => console.error("Error sharing:", error))
    } else {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast({
            title: "Link Copied!",
            description: "The link to your results has been copied to your clipboard.",
          })
        })
        .catch((error) => console.error("Error copying link:", error))
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-lg text-muted-foreground">Loading results...</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <ErrorState
            title="Failed to load results"
            description={error}
            onRetry={() => router.refresh()}
          />
        </main>
        <Footer />
      </div>
    )
  }

  if (!results) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <ErrorState
            title="No results found"
            description="It looks like there are no images for this job ID. Please try generating again."
            onRetry={() => router.push("/generate")}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main
        {...(process.env.NODE_ENV !== "production" ? { "data-testid": "results-page" } : {})}
        className="flex-1 pt-24 pb-16"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Your Family Mosaic is Ready!
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Here are the beautiful images generated for your family.
            </p>
            {isDemo && (
              <p className="mt-2 text-xs text-muted-foreground">
                This is a mock demo result (jobId: demo-001).
              </p>
            )}
            {results.provider === "runware" && !results.isMock && (
              <p className="mt-2 text-xs text-blue-400">
                ✨ 來自真實 AI 生成（Runware）
              </p>
            )}
            {results.provider === "runware" && results.identityMode && (
              <p className="mt-2 text-xs text-purple-400 font-medium">
                ✨ AI Family Portrait (Identity Mode) - 保留人物樣貌
              </p>
            )}
            {isPaid ? (
              <div
                data-testid="results-paid-badge"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                <span>Paid ✅</span>
              </div>
            ) : (
              <div
                data-testid="results-unpaid-banner"
                className="mt-4 p-3 bg-yellow-500/10 text-yellow-400 rounded-lg flex items-center justify-center gap-2"
              >
                <Lock className="w-5 h-5" />
                <span>Premium unlocks HD, no watermark. </span>
                <Button
                  variant="link"
                  className="text-yellow-400 hover:text-yellow-300 h-auto p-0"
                  onClick={() => router.push(`/pricing?job=${id}`)}
                  aria-label="Upgrade to Premium"
                  data-testid="unlock-hd-cta"
                >
                  Upgrade Now
                </Button>
              </div>
            )}
            {isPaid && (
              <div className="mt-4 p-4 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                <p className="text-center font-medium">
                  🎉 Thank you for upgrading! Your HD images are unlocked. No watermark, full resolution.
                </p>
              </div>
            )}
            {results.voucherIssued && (
              <div
                data-testid="voucher-issued-banner"
                className="mt-4 p-4 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-5 h-5" />
                  <span className="font-semibold">重生成券已發放</span>
                </div>
                <p className="text-sm text-blue-300">
                  此批品質較低（CLIP: {results.qualityScores?.clip.toFixed(2)}, BRISQUE: {results.qualityScores?.brisque.toFixed(0)}），已贈送一次重生成券（72 小時有效）。
                </p>
              </div>
            )}
          </div>

          {/* 主圖片區域：大尺寸顯示，讓生成圖成為主角 */}
          {mainImage && (
            <div className="mb-8">
              <Card className="relative overflow-hidden rounded-xl shadow-2xl glass">
                <div className="relative w-full" style={{ maxHeight: "70vh", minHeight: "400px" }}>
                  <Image
                    src={mainImage.url}
                    alt={`Generated image ${mainImage.id}`}
                    width={1200}
                    height={1200}
                    className="w-full h-full object-contain"
                    style={{ maxHeight: "70vh" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                    priority
                  />
                  {/* 浮水印覆蓋層 */}
                  <WatermarkOverlay isPaid={isPaid} isMock={results.isMock} />
                  {/* 操作按鈕（hover 時顯示） */}
                  <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 rounded-full"
                        size="sm"
                        onClick={() => handleDownloadHD(mainImage.id)}
                        disabled={!isPaid || downloadingId === mainImage.id}
                        aria-disabled={!isPaid || downloadingId === mainImage.id}
                        aria-label={
                          downloadingId === mainImage.id
                            ? "Downloading image"
                            : isPaid
                            ? "Download HD image"
                            : "Download HD - Requires premium upgrade"
                        }
                        data-testid="btn-download-hd"
                      >
                        {downloadingId === mainImage.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                            <span>Downloading...</span>
                          </>
                        ) : isPaid ? (
                          <>
                            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                            <span>Download HD</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
                            <span>Download HD</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => handleShare(mainImage)}
                        aria-label="Share image"
                      >
                        <Share2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 其他圖片：小卡片網格（如果有多張圖片） */}
          {otherImages.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4 text-center">More Variations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherImages.map((image, index) => (
                  <Card
                    key={image.id || index + 2}
                    className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 glass"
                    onMouseEnter={() => setHoveredId(image.id as number)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={image.url}
                        alt={`Generated image ${image.id || index + 2}`}
                        fill
                        className={`object-cover transition-transform duration-300 ${
                          hoveredId === image.id ? "scale-105" : "scale-100"
                        }`}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {/* 浮水印覆蓋層 */}
                      <WatermarkOverlay isPaid={isPaid} isMock={results.isMock} />
                      {/* 操作按鈕（hover 時顯示） */}
                      <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 rounded-full"
                            size="sm"
                            onClick={() => handleDownloadHD(image.id)}
                            disabled={!isPaid || downloadingId === image.id}
                            aria-disabled={!isPaid || downloadingId === image.id}
                            aria-label={
                              downloadingId === image.id
                                ? "Downloading image"
                                : isPaid
                                ? "Download HD image"
                                : "Download HD - Requires premium upgrade"
                            }
                            data-testid="btn-download-hd"
                          >
                            {downloadingId === image.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                                <span>Downloading...</span>
                              </>
                            ) : isPaid ? (
                              <>
                                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                                <span>Download HD</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
                                <span>Download HD</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleShare(image)}
                            aria-label="Share image"
                          >
                            <Share2 className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </AspectRatio>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 如果只有一張圖片，不顯示 "More Variations" */}
          {results.images.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No images available for this job.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}

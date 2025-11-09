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
import { Download, Loader2, Lock, Share2, Sparkles, Check } from "lucide-react"
import { useAuth } from "@/lib/useAuth"
import { useToast } from "@/hooks/use-toast"
import { ErrorState } from "@/components/error-state"
import { trackMetric } from "@/lib/metrics"

type ResultImage = { id: number | string; url: string; thumbnail: string }

interface ResultsResponse {
  jobId: string
  images: ResultImage[]
  paymentStatus: "paid" | "unpaid"
  createdAt: string
}

function ResultsContent() {
  const params = useParams<{ id?: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const fallbackId = searchParams.get("id") || "demo-001"
  const id = params?.id || fallbackId
  const { user, loading: authLoading } = useAuth(true)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultsResponse | null>(null)
  const [hoveredId, setHoveredId] = useState<number | string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null)
  const { toast } = useToast()

  // 單一資料來源：/api/results/:id
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

        const res = await fetch(`/api/results/${id}`, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        })

        if (!res.ok) throw new Error(`results_fetch_failed:${res.status}`)

        const data: ResultsResponse = await res.json()

        if (abort) return

        setResults(data)
        // 關鍵：只信 paymentStatus
        // isPaid 從 results.paymentStatus 推導，不需要額外的 state
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
  }, [id])

  // 從 results 推導 isPaid，不需要額外的 state
  const isPaid = results?.paymentStatus === "paid"

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
      // Trigger download via API route
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
      // Fallback for browsers that don't support Web Share API
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

  if (!results || results.images.length === 0) {
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

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Your Family Mosaic is Ready!
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Here are the beautiful images generated for your family.
            </p>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.images.map((image, index) => (
              <Card
                key={image.id || index}
                className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 glass"
                onMouseEnter={() => setHoveredId(image.id as number)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <AspectRatio ratio={1}>
                  <Image
                    src={image.url}
                    alt={`Generated image ${image.id || index + 1}`}
                    fill
                    className={`object-cover transition-transform duration-300 ${
                      hoveredId === image.id ? "scale-105" : "scale-100"
                    } ${!isPaid ? "grayscale blur-sm" : ""}`}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={index < 3}
                  />
                  {!isPaid && (
                    <div
                      data-testid="watermark-overlay"
                      className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none"
                    >
                      <span className="rotate-[-20deg] opacity-30 text-4xl font-bold select-none text-white">
                        PREVIEW
                      </span>
                    </div>
                  )}
                </AspectRatio>
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
              </Card>
            ))}
          </div>
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

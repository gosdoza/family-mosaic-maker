"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Share2, Sparkles, Lock, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/useAuth"
import { useToast } from "@/hooks/use-toast"
import { ErrorState } from "@/components/error-state"
import { trackMetric } from "@/lib/metrics"

interface ResultImage {
  id: number
  url: string
  thumbnail: string
}

interface ResultsResponse {
  jobId: string
  images: ResultImage[]
  paymentStatus: "paid" | "unpaid"
  createdAt: string
}

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const { user, loading: authLoading } = useAuth(true)
  
  const [results, setResults] = useState<ResultsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [isPaid, setIsPaid] = useState(false)
  const { toast } = useToast()

  // Check order payment status from server (fallback if results API doesn't include paymentStatus)
  useEffect(() => {
    if (!id || !results) return

    // If results already has paymentStatus, use it (set in fetchResults)
    if (results.paymentStatus === "paid" || results.paymentStatus === "unpaid") {
      return
    }

    // Fallback: check orders API if results doesn't have paymentStatus
    let canceled = false
    let timeoutId: NodeJS.Timeout

    async function checkOrderStatus() {
      try {
        // Add 5s timeout
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`/api/orders?jobId=${id}`, {
          signal: controller.signal,
        })
        
        if (!response.ok) {
          // Order might not exist, that's okay - render unpaid UI
          if (!canceled) setIsPaid(false)
          return
        }

        const data = await response.json()
        const order = data?.order
        
        if (!canceled && order && order.status === "paid") {
          setIsPaid(true)
        } else if (!canceled) {
          setIsPaid(false)
        }
      } catch (err) {
        console.error("Error checking order status:", err)
        // On error, render unpaid UI (graceful fallback)
        if (!canceled) setIsPaid(false)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    checkOrderStatus()

    return () => {
      canceled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [id, results])

  // Fetch results data
  useEffect(() => {
    if (!id) {
      setError("No job ID provided")
      setLoading(false)
      return
    }

    let canceled = false
    let timeoutId: NodeJS.Timeout

    const fetchResults = async () => {
      try {
        setLoading(true)
        
        // Add 5s timeout
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`/api/results/${id}`, {
          signal: controller.signal,
        })
        
        if (!response.ok) {
          throw new Error("Failed to fetch results")
        }

        const data: ResultsResponse = await response.json()
        
        if (!canceled) {
          setResults(data)
          // Set isPaid from results API paymentStatus if available
          // This is the primary source of truth for payment status
          if (data.paymentStatus === "paid") {
            setIsPaid(true)
          } else if (data.paymentStatus === "unpaid") {
            setIsPaid(false)
          } else {
            // If paymentStatus is not provided, default to unpaid
            setIsPaid(false)
          }
          // Track success metric
          trackMetric({ event: "generate_succeeded", jobId: id })
        }
      } catch (err) {
        if (!canceled) {
          const errorMessage = err instanceof Error ? err.message : "An error occurred"
          setError(errorMessage)
          trackMetric({ event: "generate_failed", jobId: id, metadata: { error: errorMessage } })
        }
      } finally {
        if (!canceled) {
          setLoading(false)
        }
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    fetchResults()

    return () => {
      canceled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [id])

  // Update document metadata dynamically for SEO and social sharing
  useEffect(() => {
    if (!id) return

    const title = `Family Mosaic · Result ${id}`
    const description = "AI-generated family photo — HD download after purchase."
    
    // Update document title
    document.title = title

    // Helper to update or create meta tags
    const updateMetaTag = (name: string, content: string, attribute: string = "name") => {
      let meta = document.querySelector(`meta[${attribute}="${name}"]`)
      if (!meta) {
        meta = document.createElement("meta")
        meta.setAttribute(attribute, name)
        document.head.appendChild(meta)
      }
      meta.setAttribute("content", content)
    }

    // Update description
    updateMetaTag("description", description)

    // Update Open Graph tags
    updateMetaTag("og:title", title, "property")
    updateMetaTag("og:description", description, "property")
    updateMetaTag("og:url", window.location.href, "property")
    updateMetaTag("og:type", "website", "property")

    // Update Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image")
    updateMetaTag("twitter:title", title)
    updateMetaTag("twitter:description", description)

    // Update OG image based on payment status
    let ogImage = "/og-placeholder.jpg" // Branded placeholder
    if (results && isPaid && results.images && results.images.length > 0) {
      const firstImage = results.images[0]
      ogImage = firstImage.url || firstImage.thumbnail || ogImage
    }

    // Ensure ogImage is absolute URL
    const ogImageUrl = ogImage.startsWith("http")
      ? ogImage
      : `${window.location.origin}${ogImage}`

    updateMetaTag("og:image", ogImageUrl, "property")
    updateMetaTag("twitter:image", ogImageUrl)
  }, [id, results, isPaid])

  const handleDownloadHD = async (imageId: number) => {
    if (!results || !id) return

    // Only allow download if order status is paid
    if (!isPaid) {
      // Redirect to pricing page
      router.push(`/pricing?job=${id}`)
      return
    }

    // Find the image index in the results array
    const imageIndex = results.images.findIndex((img) => img.id === imageId)
    if (imageIndex === -1) {
      console.error("Image not found")
      return
    }

    // Trigger download via API endpoint
    try {
      setDownloadingId(imageId)
      
      // Track download metric
      trackMetric({ event: "download_started", jobId: id, metadata: { index: imageIndex } })
      
      // Show toast notification
      toast({
        title: "Download Started",
        description: "Your HD image download has started!",
      })
      
      // Redirect to download API endpoint
      window.location.href = `/api/download?job=${id}&i=${imageIndex}`
    } catch (err) {
      console.error("Download error:", err)
      setDownloadingId(null)
    }
  }

  const handleShare = async (imageId: number) => {
    if (!results || !id) return

    const image = results.images.find((img) => img.id === imageId)
    if (!image) return

    const shareUrl = window.location.href
    const shareTitle = `Family Mosaic · Result ${id}`
    const shareText = "Check out my AI-generated family photo!"

    try {
      // Use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
      } else {
        // Fallback: copy link to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl)
          toast({
            title: "Link Copied",
            description: "Share link copied to clipboard!",
          })
        } catch (clipboardError) {
          // Fallback for older browsers
          const textArea = document.createElement("textarea")
          textArea.value = shareUrl
          textArea.style.position = "fixed"
          textArea.style.opacity = "0"
          document.body.appendChild(textArea)
          textArea.select()
          try {
            document.execCommand("copy")
            toast({
              title: "Link Copied",
              description: "Share link copied to clipboard!",
            })
          } catch (execError) {
            toast({
              title: "Copy Failed",
              description: "Please copy the link manually",
              variant: "destructive",
            })
          }
          document.body.removeChild(textArea)
        }
      }
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof Error && err.name !== "AbortError") {
        // If share failed but not due to user cancellation, try copy fallback
        try {
          await navigator.clipboard.writeText(shareUrl)
          toast({
            title: "Link Copied",
            description: "Share link copied to clipboard!",
          })
        } catch (clipboardError) {
          console.error("Share error:", err)
        }
      }
    }
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Retry by fetching results again
    if (id) {
      const fetchResults = async () => {
        try {
          const response = await fetch(`/api/results/${id}`)
          if (!response.ok) {
            throw new Error("Failed to fetch results")
          }
          const data: ResultsResponse = await response.json()
          setResults(data)
          // Update payment status
          if (data.paymentStatus === "paid") {
            setIsPaid(true)
          } else {
            setIsPaid(false)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
          setLoading(false)
        }
      }
      fetchResults()
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              {authLoading ? "Loading..." : "Redirecting to login..."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading your results...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
            <ErrorState
              title="Error Loading Results"
              message={error || "Failed to load results"}
              onRetry={handleRetry}
              retryLabel="Try Again"
            />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Generation Complete!</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-balance">
              Your{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Family Mosaics
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Beautiful AI-generated family moments ready to download and share
            </p>
            {isPaid ? (
              <div
                data-testid="results-paid-badge"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
                role="status"
                aria-label="Payment status: Paid"
              >
                <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-medium text-primary">
                  Paid ✅
                </span>
              </div>
            ) : (
              <div
                data-testid="results-unpaid-status"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border"
                role="status"
                aria-label="Payment status: Unpaid"
              >
                <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">
                  Upgrade to Premium to download HD images
                </span>
              </div>
            )}
          </div>

          {/* Unpaid Banner */}
          {!isPaid && id && (
            <div
              data-testid="results-unpaid-banner"
              className="mb-8"
              role="region"
              aria-label="Unlock HD premium banner"
            >
              <Card className="p-4 glass border-primary/20 bg-primary/5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium">
                      Premium unlocks HD, no watermark
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(`/pricing?job=${id}`)}
                    className="rounded-full"
                    size="sm"
                    data-testid="unlock-hd-cta"
                    aria-label="Unlock HD - Upgrade to premium to download high-resolution images"
                  >
                    Unlock HD
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Results Gallery */}
          {results.images.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="results-gallery">
              {results.images.map((image) => (
                <Card
                  key={image.id}
                  className="group overflow-hidden glass transition-all hover:shadow-2xl focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
                  onMouseEnter={() => setHoveredId(image.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  tabIndex={0}
                  role="article"
                  aria-label={`Family mosaic image ${image.id}`}
                  onKeyDown={(e) => {
                    // Allow Enter/Space to trigger Download/Unlock on focused card
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      if (isPaid) {
                        handleDownloadHD(image.id)
                      } else {
                        router.push(`/pricing?job=${id}`)
                      }
                    }
                  }}
                >
                  <div className="relative aspect-square">
                    <img
                      src={image.thumbnail || image.url || "/placeholder.svg"}
                      alt={`Generated family photo ${image.id}`}
                      className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
                        !isPaid ? "opacity-75 blur-sm" : ""
                      }`}
                    />
                    {/* Watermark and blur overlay for unpaid version */}
                    {!isPaid && (
                      <div
                        data-testid="watermark-overlay"
                        className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20"
                        aria-hidden="true"
                        role="presentation"
                      >
                        <div className="text-4xl font-bold text-white/30 select-none transform -rotate-45">
                          PREVIEW
                        </div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity ${
                        hoveredId === image.id ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                        <div className="flex gap-3">
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
                            className="rounded-full glass bg-transparent"
                            onClick={() => handleShare(image.id)}
                            aria-label="Share this family mosaic image"
                          >
                            <Share2 className="w-4 h-4" aria-hidden="true" />
                            <span className="sr-only">Share</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 glass text-center">
              <p className="text-muted-foreground">No images found for this job.</p>
            </Card>
          )}

          {/* Generate More */}
          <div className="text-center mt-12">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full glass bg-transparent"
              onClick={() => router.push("/generate")}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate More
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

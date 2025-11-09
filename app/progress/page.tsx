"use client"

import { Suspense } from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Sparkles, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface ProgressResponse {
  jobId: string
  status: "pending" | "processing" | "succeeded" | "failed"
  progress: number
  message?: string
}

function ProgressContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get("job")
  
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<ProgressResponse["status"]>("pending")
  const [message, setMessage] = useState("Processing Magic...")

  useEffect(() => {
    if (!jobId) {
      // If no job ID, redirect to generate page
      router.push("/generate")
      return
    }

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/progress/${jobId}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch progress")
        }

        const data: ProgressResponse = await response.json()
        
        setProgress(data.progress)
        setStatus(data.status)
        if (data.message) {
          setMessage(data.message)
        }

        // If status is succeeded, redirect to results page
        if (data.status === "succeeded") {
          setTimeout(() => {
            router.push(`/results?id=${data.jobId}`)
          }, 500)
          return
        }

        // If status is failed, show error (could add error handling UI here)
        if (data.status === "failed") {
          console.error("Generation failed")
          // Could redirect to an error page or show error message
        }
      } catch (error) {
        console.error("Error polling progress:", error)
        // Continue polling even on error
      }
    }

    // Poll immediately, then every 1500ms
    pollProgress()
    const interval = setInterval(pollProgress, 1500)

    return () => clearInterval(interval)
  }, [jobId, router])

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
          <Card className="p-12 glass text-center space-y-8">
            <div className="relative inline-block">
              <Sparkles className="w-16 h-16 text-primary mx-auto animate-pulse" />
              <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-balance">{message}</h2>
              <p className="text-muted-foreground text-pretty">
                {status === "succeeded" 
                  ? "Your beautiful family moment is ready!"
                  : status === "failed"
                  ? "Something went wrong. Please try again."
                  : "Our AI is creating your beautiful family moment"}
              </p>
            </div>

            {/* Progress Circle */}
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className={`transition-all duration-500 ${
                    status === "succeeded" 
                      ? "text-primary" 
                      : status === "failed"
                      ? "text-destructive"
                      : "text-primary"
                  }`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Skeleton Previews */}
            {status !== "succeeded" && status !== "failed" && (
              <div className="grid grid-cols-3 gap-4 pt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted/30 animate-pulse" />
                ))}
              </div>
            )}

            {/* Job ID Display */}
            {jobId && (
              <p className="text-xs text-muted-foreground pt-4">
                Job ID: {jobId}
              </p>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function ProgressPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <ProgressContent />
    </Suspense>
  )
}

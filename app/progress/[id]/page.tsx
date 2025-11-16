"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { ErrorState } from "@/components/error-state"
import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"

interface ProgressResponse {
  jobId: string
  status: "pending" | "processing" | "succeeded" | "failed"
  progress: number
  message?: string
}

export default function ProgressPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const jobId = params.id
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<ProgressResponse["status"]>("pending")
  const [message, setMessage] = useState("Processing Magic...")
  const [tick, setTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [simulatedProgress, setSimulatedProgress] = useState(0)

  // Route A: demo-001 或 mock mode 的 polling 逻辑
  useEffect(() => {
    // demo-001 或 mock mode 都需要 polling
    if (!jobId || (jobId !== "demo-001" && !isMock)) return

    let canceled = false
    let pollCount = 0
    const maxPolls = 60 // 最多轮询 60 次（90 秒）

    // 立即检查一次状态（不等待第一次 interval）
    const checkStatus = async () => {
      if (canceled) return

      try {
        const response = await fetch(`/api/progress/${jobId}`)
        if (!response.ok) {
          console.error("[progress] polling failed", { jobId, status: response.status })
          return
        }

        const data: ProgressResponse = await response.json()
        
        console.log("[progress] polling", { jobId, status: data.status, progress: data.progress })
        
        // 更新 UI 状态
        if (!canceled) {
          setStatus(data.status)
          setProgress(data.progress || 0)
          if (data.message) {
            setMessage(data.message)
          }
        }
        
        if (data.status === "succeeded") {
          if (!canceled) {
            console.log("[progress] redirecting to results", jobId)
            router.push(`/results/${jobId}`)
          }
          return true // 返回 true 表示已完成，不需要继续 polling
        } else if (data.status === "failed") {
          if (!canceled) {
            setError("Generation failed. Please try again.")
          }
          return true // 返回 true 表示已失败，不需要继续 polling
        }
      } catch (error) {
        console.error("[progress] Error polling progress:", error)
        if (!canceled) {
          setError("Failed to fetch progress. Please try again.")
        }
      }
      return false
    }

    // 立即检查一次
    let pollInterval: NodeJS.Timeout | null = null
    
    checkStatus().then((completed) => {
      if (completed || canceled) return

      // 如果还没完成，开始定期 polling
      pollInterval = setInterval(async () => {
        if (canceled || pollCount >= maxPolls) {
          if (pollInterval) clearInterval(pollInterval)
          return
        }

        pollCount++

        const completed = await checkStatus()
        if (completed && pollInterval) {
          clearInterval(pollInterval)
        }
      }, 1000) // 每 1 秒轮询一次
    })

    return () => {
      canceled = true
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [isMock, jobId, router])

  // Realistic progress simulation with staged increments and random delays
  useEffect(() => {
    if (isMock || !jobId || status === "succeeded" || status === "failed") return

    let canceled = false
    let currentProgress = 0
    const stages = [
      { target: 15, delay: 500 },
      { target: 30, delay: 800 },
      { target: 45, delay: 1200 },
      { target: 60, delay: 1000 },
      { target: 75, delay: 1500 },
      { target: 90, delay: 2000 },
      { target: 95, delay: 2500 }, // Cap at 95% until finished
    ]

    let stageIndex = 0

    function advanceProgress() {
      if (canceled || status === "succeeded" || status === "failed") return

      if (stageIndex < stages.length) {
        const stage = stages[stageIndex]
        currentProgress = Math.min(stage.target, 95) // Cap at 95%
        setSimulatedProgress(currentProgress)
        stageIndex++

        if (stageIndex < stages.length) {
          const delay = stage.delay + Math.random() * 500 // Add random delay
          setTimeout(advanceProgress, delay)
        }
      }
    }

    // Start progress simulation
    advanceProgress()

    return () => {
      canceled = true
    }
  }, [isMock, jobId, status])

  // Polling logic for non-mock mode (非 demo-001 且非 mock)
  useEffect(() => {
    if (isMock || !jobId || jobId === "demo-001") return

    const t = setInterval(() => setTick((x) => x + 1), 1500) // 每 1.5 秒轮询一次
    return () => clearInterval(t)
  }, [isMock, jobId])

  useEffect(() => {
    if (isMock || !jobId || jobId === "demo-001") return

    let canceled = false

    async function poll() {
      try {
        const response = await fetch(`/api/progress/${jobId}`)
        if (!response.ok) {
          if (!canceled) {
            setError("Failed to fetch progress")
          }
          return
        }

        const data: ProgressResponse = await response.json()
        
        if (!canceled) {
          // Use simulated progress if status is still processing, otherwise use real progress
          const displayProgress = data.status === "processing" || data.status === "pending"
            ? Math.max(simulatedProgress, data.progress)
            : data.progress

          setProgress(Math.min(displayProgress, 95)) // Cap at 95% until finished
          setStatus(data.status)
          if (data.message) {
            setMessage(data.message)
          }

          if (data.status === "succeeded") {
            setProgress(100) // Show 100% when succeeded
            router.push(`/results/${data.jobId}`)
            return
          }

          if (data.status === "failed") {
            setError("Generation failed. Please try again.")
          }
        }
      } catch (error) {
        console.error("Error polling progress:", error)
        if (!canceled) {
          setError("Failed to fetch progress. Please try again.")
        }
      }
    }

    poll()

    return () => {
      canceled = true
    }
  }, [tick, isMock, jobId, router, simulatedProgress])

  // If no job ID, redirect to generate
  useEffect(() => {
    if (!jobId && !isMock) {
      router.push("/generate")
    }
  }, [jobId, isMock, router])

  const handleRetry = () => {
    setError(null)
    setProgress(0)
    setSimulatedProgress(0)
    setStatus("pending")
    setTick(0)
    // Retry by resetting and polling again
    if (jobId) {
      setTick((prev) => prev + 1)
    }
  }

  if (error && status === "failed") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
            <ErrorState
              title="Generation Failed"
              message={error}
              onRetry={handleRetry}
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

      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 gradient-animate" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
          {error ? (
            <ErrorState
              title="Error Loading Progress"
              message={error}
              onRetry={handleRetry}
            />
          ) : (
            <Card
              {...(process.env.NODE_ENV !== "production" ? { "data-testid": "progress-page" } : {})}
              className="p-12 glass text-center space-y-8"
            >
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
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}


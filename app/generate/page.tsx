"use client"

import type React from "react"
import { Suspense } from "react"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { UploadCard } from "@/components/ui/upload-card"
import { StylePresetList, type StylePreset } from "@/components/ui/style-preset-list"
import { TemplatePicker, type Template } from "@/components/ui/template-picker"
import { Sparkles, ChevronRight, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { ErrorState } from "@/components/error-state"
import { trackMetric } from "@/lib/metrics"
import { isDemoMode, isPreviewEnv as getIsPreviewEnv, isDemoJob, runwareMode, isForceRealGenerate } from "@/lib/featureFlags"

const STYLE_PRESETS: StylePreset[] = [
  { id: "realistic", name: "Realistic", emoji: "📸", description: "Natural, lifelike family portraits" },
  { id: "anime", name: "Anime", emoji: "🎨", description: "Vibrant, stylized illustrations" },
  { id: "vintage", name: "Vintage", emoji: "📷", description: "Classic, timeless photography" },
]

const TEMPLATE_COLLECTIONS: Template[] = [
  { id: "christmas", name: "Christmas", emoji: "🎄", description: "Cozy holiday celebrations" },
  { id: "birthday", name: "Birthday", emoji: "🎂", description: "Special birthday moments" },
  { id: "wedding", name: "Wedding", emoji: "💒", description: "Elegant ceremony scenes" },
  { id: "graduation", name: "Graduation", emoji: "🎓", description: "Achievement celebrations" },
  { id: "reunion", name: "Family Reunion", emoji: "👨‍👩‍👧‍👦", description: "Joyful gatherings" },
]

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedStyle, setSelectedStyle] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useRealAI, setUseRealAI] = useState(false) // TASK 1: Per-request flag for real AI
  const { toast } = useToast()
  // NOTE: behavior preserved, just using centralized feature flags
  const isMock = isDemoMode
  const e2e = searchParams.get("e2e") === "1"
  
  // Use centralized isPreviewEnv from featureFlags (don't override with hostname check)
  // The hostname-based check was causing localhost to be treated as preview
  const isPreviewEnv = getIsPreviewEnv

  // 前端旗標：讀取 NEXT_PUBLIC_RUNWARE_ENABLED 判斷是否啟用 Runware
  // TASK 1: Explicitly check for "true" to ensure checkbox shows correctly
  const runwareEnabled =
    typeof process.env.NEXT_PUBLIC_RUNWARE_ENABLED === "string"
      ? process.env.NEXT_PUBLIC_RUNWARE_ENABLED === "true"
      : false

  // TASK 1: Debug log for runwareEnabled
  useEffect(() => {
    console.log("[generate][debug] runwareEnabled =", runwareEnabled, {
      envValue: process.env.NEXT_PUBLIC_RUNWARE_ENABLED,
      envType: typeof process.env.NEXT_PUBLIC_RUNWARE_ENABLED,
    })
  }, [runwareEnabled])

  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files)
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const canProceed = () => {
    // In mock + e2e mode, always allow proceeding
    if (isMock && e2e) return true
    if (currentStep === 1) return uploadedFiles.length > 0
    if (currentStep === 2) return selectedStyle !== ""
    if (currentStep === 3) return selectedTemplate !== ""
    // Step 4: Check if all inputs are ready for generation
    if (currentStep === 4) {
      return uploadedFiles.length > 0 && selectedStyle !== "" && selectedTemplate !== ""
    }
    return false
  }
  
  // Check if generation is allowed (for button disabled state)
  const canGenerate = () => {
    // Basic requirements: files, style, template
    const hasBasicInputs = uploadedFiles.length > 0 && selectedStyle !== "" && selectedTemplate !== ""
    
    // In mock mode or preview, allow generation with basic inputs
    if (isMock || isPreviewEnv || e2e) {
      return hasBasicInputs && !isGenerating
    }
    
    // In production (non-mock), use canProceed() which may include additional checks
    return canProceed() && !isGenerating
  }

  // E2E quick pass: auto-fill and jump to step 4
  useEffect(() => {
    const isProd = process.env.NODE_ENV === "production"
    // Only allow e2e mode in mock & non-production environments
    if (!isMock || isProd || !e2e) return

    // Auto-select first style if not selected
    if (!selectedStyle && STYLE_PRESETS.length > 0) {
      setSelectedStyle(STYLE_PRESETS[0].id)
    }

    // Auto-select first template if not selected
    if (!selectedTemplate && TEMPLATE_COLLECTIONS.length > 0) {
      setSelectedTemplate(TEMPLATE_COLLECTIONS[0].id)
    }

    // Jump directly to step 4 (Generate button)
    if (currentStep < 4) {
      setCurrentStep(4)
    }
  }, [isMock, e2e, selectedStyle, selectedTemplate, currentStep])

  // Debug: Log feature flags on component mount and when they change
  useEffect(() => {
    console.log("[generate][flags]", {
      isDemoMode,
      isPreviewEnv,
      runwareMode,
      isForceRealGenerate,
      runwareEnabled, // TASK 1: Include runwareEnabled in flags log
      nodeEnv: process.env.NODE_ENV,
      nextPublicUseMock: process.env.NEXT_PUBLIC_USE_MOCK,
      nextPublicDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE,
      nextPublicRunwareMode: process.env.NEXT_PUBLIC_RUNWARE_MODE,
      nextPublicRunwareEnabled: process.env.NEXT_PUBLIC_RUNWARE_ENABLED, // TASK 1: Include in flags log
      nextPublicForceRealGenerate: process.env.NEXT_PUBLIC_FORCE_REAL_GENERATE,
      vercelEnv: process.env.VERCEL_ENV,
      nextPublicVercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    })
  }, [isDemoMode, isPreviewEnv, runwareMode, isForceRealGenerate, runwareEnabled])

  // Debug: Log state changes for troubleshooting
  useEffect(() => {
    console.log("[generate][debug-state]", {
      currentStep,
      uploadedCount: uploadedFiles.length,
      selectedStyle,
      selectedTemplate,
      isMock,
      isPreviewEnv,
      e2e,
      isGenerating,
      canProceed: canProceed(),
      canGenerate: typeof canGenerate === "function" ? canGenerate() : "(not in scope)",
    })
  }, [
    currentStep,
    uploadedFiles.length,
    selectedStyle,
    selectedTemplate,
    isMock,
    isPreviewEnv,
    e2e,
    isGenerating,
  ])

  /**
   * Handle Generate button click
   * 
   * Strategy:
   * - Preview/Demo mode: Direct navigation to demo-001 (Route A)
   * - Production/Real mode: Call /api/generate and navigate based on jobId
   * - Force Real mode: Override demo/preview flags for local development
   */
  const handleGenerate = async () => {
    // Set loading state
    setIsGenerating(true)
    setError(null)

    try {
      // Determine if we should use demo flow or real flow
      const demoCandidate = isDemoMode || isPreviewEnv
      
      // Force real generate if:
      // 1. NEXT_PUBLIC_FORCE_REAL_GENERATE=true is set, OR
      // 2. We're in local dev (NODE_ENV !== "production") AND runwareMode === "real"
      const shouldForceReal =
        isForceRealGenerate ||
        (process.env.NODE_ENV !== "production" && runwareMode === "real")
      
      const shouldUseDemoFlow = demoCandidate && !shouldForceReal

      // Route A: Preview/Demo mode - direct navigation to demo-001
      if (shouldUseDemoFlow) {
        console.log("[generate][route-a] Demo flow", {
          isDemoMode,
          isPreviewEnv,
          shouldForceReal,
          runwareMode,
        })
        const mockJobId = "demo-001"
        // Reset loading state before navigation (navigation will unmount component)
        setIsGenerating(false)
        router.push(`/progress/${mockJobId}`)
        return
      }

      // Route B: Production/Real mode - call /api/generate
      console.log("[generate][route-b] Real flow: calling /api/generate", {
        uploadedCount: uploadedFiles.length,
        style: selectedStyle,
        template: selectedTemplate,
        runwareMode,
        isForceRealGenerate,
        shouldForceReal,
        demoCandidate,
      })

      // Validate inputs
      if (uploadedFiles.length === 0) {
        throw new Error("Please upload at least one portrait")
      }
      if (!selectedStyle) {
        throw new Error("Please select a style")
      }
      if (!selectedTemplate) {
        throw new Error("Please select a template")
      }

      // Prepare FormData for /api/generate
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append("files", file)
      })
      formData.append("style", selectedStyle)
      formData.append("template", selectedTemplate)
      // TASK 1: Include useReal flag in request
      formData.append("useReal", useRealAI ? "true" : "false")

      // Call /api/generate
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      // TASK 3: Log raw response for debugging
      console.log("[generate][route-b] raw response", {
        responseOk: response.ok,
        dataOk: data.ok,
        dataJobId: data.jobId,
        dataProvider: data.provider,
        dataIsFallback: data.isFallback,
        fullData: data,
      })

      // TASK 3: Handle error response - only fail if:
      // - HTTP response is not ok (4xx/5xx), OR
      // - data.ok is explicitly false, OR
      // - no jobId is present
      // If data.ok === true and jobId exists, treat as success regardless of provider
      if (!response.ok) {
        // HTTP error (4xx/5xx)
        const errorMessage = data.error || data.message || `HTTP ${response.status}: Failed to start generation`
        console.error("[generate][route-b] HTTP error:", response.status, errorMessage)
        throw new Error(errorMessage)
      }
      
      if (data.ok === false || !data.jobId) {
        // API returned error or missing jobId
        const errorMessage = data.error || data.message || "Failed to start generation"
        console.error("[generate][route-b] API error:", errorMessage)
        
        // In dev, log debug info if available
        const isDev = process.env.NODE_ENV !== "production"
        if (isDev && data.debug) {
          console.error("[generate][route-b] API debug:", data.debug)
        }
        
        // Create error with debug info attached
        const error = new Error(errorMessage) as any
        if (data.debug) {
          error.debug = data.debug
        }
        throw error
      }

      // TASK 3: Success - data.ok === true and jobId exists (mock or runware)
      const jobId = data.jobId
      console.log("[generate][route-b] Success:", { 
        jobId, 
        request_id: data.request_id,
        provider: data.provider || "unknown",
        isFallback: data.isFallback || false,
        ok: data.ok,
      })

      // Clear any previous error state
      setError(null)
      
      // If jobId is demo-001, navigate to results (Route A compatibility)
      if (isDemoJob(jobId)) {
        router.push(`/results/${jobId}`)
      } else {
        // Real job: navigate to progress page
        router.push(`/progress/${jobId}`)
      }
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : "Failed to generate family photo"
      console.error("[generate][error]", {
        message: errorMessage,
        cause: err,
        stack: err instanceof Error ? err.stack : undefined,
      })
      
      // If we have debug info from API response, log it
      if (err instanceof Error && (err as any).debug) {
        console.error("[generate][route-b] API debug:", (err as any).debug)
      }
      
      setError(errorMessage)
      
      // Show toast notification
      // In dev, show more detail if available
      const isDev = process.env.NODE_ENV !== "production"
      const debugInfo = (err as any).debug
      const toastDescription = isDev && debugInfo
        ? `${errorMessage}\n\nDebug: ${debugInfo.name || ""} ${debugInfo.status || ""} ${debugInfo.message || ""}`
        : errorMessage
      
      toast({
        title: "Generation Failed",
        description: toastDescription,
        variant: "destructive",
      })
      
      setIsGenerating(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    setIsGenerating(false)
    // Retry generation
    handleGenerate()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Runware 狀態提示 */}
          {!runwareEnabled && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    目前為本機開發模式
                  </p>
                  <p className="text-blue-800 dark:text-blue-200">
                    使用的是模擬圖片生成，不會消耗 Runware 點數。正式上線時才會啟用真實 AI 生成。
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-balance">
              Create Your{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Family Mosaic
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Follow these simple steps to transform your portraits into beautiful family moments
            </p>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-4 mb-12">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all ${
                    currentStep >= step
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 4 && <div className={`w-12 h-1 rounded ${currentStep > step ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {error ? (
            <ErrorState
              title="Generation Error"
              message={error}
              onRetry={handleRetry}
            />
          ) : (
            <div className="space-y-8">
              {/* Step 1: Upload Portraits */}
              {currentStep === 1 && (
                <UploadCard
                  onFilesChange={handleFilesChange}
                  uploadedFiles={uploadedFiles}
                  onRemoveFile={handleRemoveFile}
                />
              )}

              {/* Step 2: Choose Style */}
              {currentStep === 2 && (
                <StylePresetList
                  presets={STYLE_PRESETS}
                  selectedStyle={selectedStyle}
                  onStyleSelect={setSelectedStyle}
                />
              )}

              {/* Step 3: Choose Template */}
              {currentStep === 3 && (
                <TemplatePicker
                  templates={TEMPLATE_COLLECTIONS}
                  selectedTemplate={selectedTemplate}
                  onTemplateSelect={setSelectedTemplate}
                />
              )}

              {/* Step 4: Generate */}
              {currentStep === 4 && (
                <Card className="p-12 glass text-center space-y-6">
                  {/* DEBUG Banner */}
                  <div className="w-full bg-[#fde68a] text-center py-3 font-bold text-lg mb-4">
                    *** DEBUG BUILD – GENERATE PAGE ***
                  </div>
                  <Sparkles className="w-16 h-16 text-primary mx-auto" />
                  <h3 className="text-2xl font-semibold">Ready to Generate</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {runwareEnabled
                      ? "Your beautiful family photo will be generated using AI (may consume credits)"
                      : "Your beautiful family photo will be ready in about 60 seconds (demo mode)"}
                  </p>
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground pt-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{uploadedFiles.length} portraits uploaded</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{STYLE_PRESETS.find((s) => s.id === selectedStyle)?.name} style</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{TEMPLATE_COLLECTIONS.find((t) => t.id === selectedTemplate)?.name} template</span>
                    </div>
                  </div>
                  
                  {/* TASK 1: Real AI Toggle Checkbox (only visible when runwareEnabled) */}
                  {runwareEnabled && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={useRealAI}
                          onChange={(e) => setUseRealAI(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-2"
                        />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                          使用真實 AI 生成（會消耗 Runware 點數）
                        </span>
                      </label>
                    </div>
                  )}
                </Card>
              )}

              {/* Navigation Buttons */}
            <div className="flex gap-4 justify-between pt-6">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full bg-transparent"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || isGenerating}
              >
                Back
              </Button>

              {currentStep < 4 ? (
                <Button
                  size="lg"
                  className="rounded-full"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                >
                  Next Step
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <>
                  {(() => {
                    // 原本的 disabled 邏輯：!canGenerate()
                    const originalDisabled = !canGenerate()
                    // 在 preview 環境一律解鎖，方便測試
                    const generateDisabled = isPreviewEnv ? false : originalDisabled
                    
                    return (
                <Button
                  type="button"
                  {...(process.env.NODE_ENV !== "production" ? { "data-testid": "btn-generate" } : {})}
                  size="lg"
                  className="rounded-full shadow-lg hover:shadow-xl transition-all"
                  onClick={handleGenerate}
                        disabled={generateDisabled}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {runwareEnabled ? "Generating with AI..." : "Generating (Demo)..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      {runwareEnabled ? "Generate Family Photo (AI)" : "Generate Family Photo (Demo)"}
                    </>
                  )}
                </Button>
                    )
                  })()}
                  
                  {/* DEBUG: Generate Page State (Preview Only) */}
                  {isPreviewEnv && (
                    <div className="mt-8 rounded-xl border border-dashed border-red-500 bg-red-50 p-4 text-xs font-mono text-red-800 space-y-2" data-debug-generate>
                      <div className="font-bold text-red-700 mb-1">
                        DEBUG – Generate Page State (preview only)
                      </div>
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          {
                            currentStep,
                            uploadedCount: uploadedFiles?.length || 0,
                            selectedStyle,
                            selectedTemplate,
                            isMock,
                            isPreviewEnv,
                            e2e,
                            isGenerating,
                            canProceed: canProceed(),
                            canGenerate: typeof canGenerate === "function" ? canGenerate() : "(not in scope)",
                            generateEndpoint: (isDemoMode || isPreviewEnv) && !isForceRealGenerate && !(process.env.NODE_ENV !== "production" && runwareMode === "real") ? "MOCK (direct demo-001)" : "/api/generate",
                            runwareMode,
                            isForceRealGenerate,
                            shouldForceReal: isForceRealGenerate || (process.env.NODE_ENV !== "production" && runwareMode === "real"),
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <GenerateContent />
    </Suspense>
  )
}

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
  const { toast } = useToast()
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  const e2e = searchParams.get("e2e") === "1"

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
    return false
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

  const handleGenerate = async () => {
    // In mock mode, skip validation and directly navigate
    if (isMock) {
      trackMetric({ event: "generate_started", jobId: "demo-001" })
      toast({
        title: "Job Created",
        description: "Your family mosaic generation has started!",
      })
      router.push("/progress/demo-001")
      return
    }

    // Non-mock mode: validate and call API
    if (!canProceed()) return

    setIsGenerating(true)
    setError(null)

    try {
      // Create FormData to send files
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append("files", file)
      })
      formData.append("style", selectedStyle)
      formData.append("template", selectedTemplate)

      // Call the API
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate")
      }

      const data = await response.json()
      const jobId = data.jobId

      // Track metric
      trackMetric({ event: "generate_started", jobId })

      // Show toast notification
      toast({
        title: "Job Created",
        description: "Your family mosaic generation has started!",
      })

      // Navigate to progress page with job ID
      router.push(`/progress/${jobId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      setIsGenerating(false)
      
      // Track failure
      trackMetric({ event: "generate_failed", metadata: { error: errorMessage } })
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
                  <Sparkles className="w-16 h-16 text-primary mx-auto" />
                  <h3 className="text-2xl font-semibold">Ready to Generate!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your beautiful family photo will be ready in about 60 seconds
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
                <Button
                  type="button"
                  {...(process.env.NODE_ENV !== "production" ? { "data-testid": "btn-generate" } : {})}
                  size="lg"
                  className="rounded-full shadow-lg hover:shadow-xl transition-all"
                  onClick={handleGenerate}
                  disabled={!isMock && !e2e && (isGenerating || !canProceed())}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Family Photo
                    </>
                  )}
                </Button>
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

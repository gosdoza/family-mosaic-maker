"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <Card className="p-12 glass text-center space-y-6">
      <div className="relative inline-block">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
        <div className="absolute -inset-4 bg-destructive/10 rounded-full blur-xl" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-muted-foreground text-pretty max-w-md mx-auto">
          {message}
        </p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          className="rounded-full"
          size="lg"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {retryLabel}
        </Button>
      )}
    </Card>
  )
}


/**
 * Lightweight metrics tracking
 * Sends events to /api/metrics endpoint and GA4
 */

import {
  trackGenerateStart,
  trackGenerateSuccess,
  trackGenerateFail,
  trackPaymentStart,
  trackPurchaseSuccess,
  trackDownloadClick,
  trackLoginRequest,
  trackLoginSuccess,
} from "@/lib/analytics/ga4"

export type MetricEvent =
  | "generate_started"
  | "generate_succeeded"
  | "generate_failed"
  | "payment_paid"
  | "payment_failed"
  | "download_started"
  | "purchase_success"
  | "login_request"
  | "login_success"

interface MetricPayload {
  event: MetricEvent
  jobId?: string
  orderId?: string
  metadata?: Record<string, any>
}

/**
 * Track a metric event
 * Non-blocking, fire-and-forget
 * Also sends to GA4 if available
 */
export async function trackMetric(payload: MetricPayload): Promise<void> {
  try {
    // Fire and forget - don't wait for response
    fetch("/api/metrics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      // Silently fail - metrics should not break the app
      console.warn("Failed to track metric:", error)
    })

    // Also send to GA4 (client-side only)
    if (typeof window !== "undefined") {
      try {
        switch (payload.event) {
          case "generate_started":
            trackGenerateStart(payload.jobId || "", payload.metadata)
            break
          case "generate_succeeded":
            trackGenerateSuccess(payload.jobId || "", payload.metadata)
            break
          case "generate_failed":
            trackGenerateFail(
              payload.jobId || "",
              payload.metadata?.error as string,
              payload.metadata
            )
            break
          case "payment_paid":
          case "payment_started":
            trackPaymentStart(
              payload.jobId || "",
              payload.metadata?.amount as string,
              payload.metadata?.currency as string
            )
            break
          case "purchase_success":
            trackPurchaseSuccess(
              payload.jobId || "",
              payload.orderId || "",
              payload.metadata?.amount as string || "0",
              payload.metadata?.currency as string || "USD"
            )
            break
          case "download_started":
            trackDownloadClick(
              payload.jobId || "",
              payload.metadata?.quality as string,
              payload.metadata
            )
            break
          case "login_request":
            trackLoginRequest(payload.metadata?.email_hash as string)
            break
          case "login_success":
            trackLoginSuccess(
              payload.metadata?.user_id as string,
              payload.metadata?.email_hash as string
            )
            break
        }
      } catch (error) {
        // Silently fail - GA4 should not break the app
        console.warn("Failed to track GA4 event:", error)
      }
    }
  } catch (error) {
    // Silently fail - metrics should not break the app
    console.warn("Failed to track metric:", error)
  }
}


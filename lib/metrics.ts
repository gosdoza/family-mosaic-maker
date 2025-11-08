/**
 * Lightweight metrics tracking
 * Sends events to /api/metrics endpoint
 */

export type MetricEvent =
  | "generate_started"
  | "generate_succeeded"
  | "generate_failed"
  | "payment_paid"
  | "payment_failed"
  | "download_started"

interface MetricPayload {
  event: MetricEvent
  jobId?: string
  orderId?: string
  metadata?: Record<string, any>
}

/**
 * Track a metric event
 * Non-blocking, fire-and-forget
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
  } catch (error) {
    // Silently fail - metrics should not break the app
    console.warn("Failed to track metric:", error)
  }
}


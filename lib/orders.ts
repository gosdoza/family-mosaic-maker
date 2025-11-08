import { createClient } from "@/lib/supabase/server"
import { IS_MOCK } from "@/lib/config"

export interface OrderInput {
  jobId: string
  status: "pending" | "approved" | "paid" | "failed" | "refunded"
  approvalUrl?: string
  amountCents?: number
  currency?: string
}

export interface OrderUpdate {
  paypal_order_id?: string
  paypal_capture_id?: string
  payer_email?: string
}

export async function createOrderRecord(input: OrderInput) {
  // In mock mode, return a mock order without database
  if (IS_MOCK) {
    return {
      id: `order_${Date.now()}`,
      job_id: input.jobId,
      status: input.status,
      approval_url: input.approvalUrl ?? null,
      amount_cents: input.amountCents ?? 299,
      currency: input.currency ?? "USD",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .insert({
      job_id: input.jobId,
      status: input.status,
      approval_url: input.approvalUrl ?? null,
      amount_cents: input.amountCents ?? 299,
      currency: input.currency ?? "USD",
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating order:", error)
    throw error
  }

  return data
}

export async function updateOrderPaidByJob(
  jobId: string,
  patch: OrderUpdate
) {
  // In mock mode, just log the update
  if (IS_MOCK) {
    console.log(`Mock: Update order for job ${jobId} to paid`, patch)
    return {
      id: `order_${Date.now()}`,
      job_id: jobId,
      status: "paid",
      ...patch,
      updated_at: new Date().toISOString(),
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .select()
    .single()

  if (error) {
    console.error("Error updating order:", error)
    throw error
  }

  return data
}

export async function getOrderByJob(jobId: string) {
  // In mock mode, return a mock paid order for demo-001
  if (IS_MOCK && jobId === "demo-001") {
    return {
      id: "order_mock_001",
      job_id: jobId,
      status: "paid",
      amount_cents: 299,
      currency: "USD",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching order:", error)
    throw error
  }

  return data
}

export async function recordWebhookEvent(
  eventId: string,
  resourceId: string | null,
  eventType: string
) {
  // In mock mode, mark as processed and log
  if (IS_MOCK) {
    if (typeof markWebhookEventProcessed === "function") {
      markWebhookEventProcessed(eventId)
    }
    console.log(`Mock: Record webhook event ${eventId}`, { resourceId, eventType })
    return {
      id: eventId,
      resource_id: resourceId,
      event_type: eventType,
      received_at: new Date().toISOString(),
    }
  }

  const supabase = await createClient()

  // Use upsert with conflict handling for idempotency
  const { data, error } = await supabase
    .from("webhook_events")
    .upsert(
      {
        id: eventId,
        resource_id: resourceId,
        event_type: eventType,
        received_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
        ignoreDuplicates: true,
      }
    )
    .select()
    .single()

  // If error is a duplicate key error, that's fine (idempotency)
  if (error && !error.message.includes("duplicate")) {
    console.error("Error recording webhook event:", error)
    throw error
  }

  return data
}

// Store processed events in memory for mock mode
const processedEvents = new Set<string>()

export async function hasWebhookEventBeenProcessed(eventId: string) {
  // In mock mode, use in-memory set
  if (IS_MOCK) {
    return processedEvents.has(eventId)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle()

  if (error) {
    console.error("Error checking webhook event:", error)
    return false
  }

  return !!data
}

// Helper to mark event as processed in mock mode
export function markWebhookEventProcessed(eventId: string) {
  if (IS_MOCK) {
    processedEvents.add(eventId)
  }
}


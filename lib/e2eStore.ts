/**
 * Dev-only E2E Store (in-memory)
 * Used for E2E testing without database dependencies
 */

export type E2EJob = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  result_urls: string[]
  user_id?: string
}

export type E2EOrder = {
  id: string
  job_id: string
  status: "pending" | "paid" | "failed"
  provider?: string
  provider_ref?: string
  user_id?: string
}

export interface E2EStore {
  jobs: Map<string, E2EJob>
  orders: Map<string, E2EOrder>
}

// Use globalThis to persist across hot reloads in dev
const store: E2EStore =
  (globalThis as any).__e2eStore ??
  ({ jobs: new Map(), orders: new Map() } as E2EStore)

;(globalThis as any).__e2eStore = store

export default store


/**
 * Feature Flags - Centralized configuration for demo/mock modes
 * 
 * This module provides type-safe feature flags for controlling:
 * - Runware generation mode (mock vs real)
 * - PayPal payment mode (mock vs sandbox vs live)
 * - Demo mode detection
 * - Environment detection (preview vs production)
 * 
 * NOTE: This refactoring preserves existing behavior, just centralizes the logic.
 */

export type RunwareMode = "mock" | "real"

export type PaypalMode = "mock" | "sandbox" | "live"

// ============================================
// Environment Detection
// ============================================

/**
 * Check if we're in Vercel preview environment
 */
export const isPreviewEnv =
  process.env.VERCEL_ENV === "preview" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"

/**
 * Check if we're in production environment
 */
export const isProdEnv =
  process.env.VERCEL_ENV === "production" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production"

// ============================================
// Legacy Support (Backward Compatibility)
// ============================================

/**
 * Legacy flag: NEXT_PUBLIC_USE_MOCK
 * Kept for backward compatibility, will be used as fallback
 */
const legacyUseMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

// ============================================
// Demo Mode Detection
// ============================================

/**
 * Demo Mode: Currently defined as "legacy mock enabled OR explicit demo mode"
 * 
 * In demo mode:
 * - /orders and /results/demo-001 can be accessed without auth (in preview)
 * - Mock data is returned for demo-001 jobs
 * - Mock checkout flow is used
 */
export const isDemoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || legacyUseMock

// ============================================
// Runware Mode
// ============================================

/**
 * Runware generation mode
 * Priority: NEXT_PUBLIC_RUNWARE_MODE > NEXT_PUBLIC_USE_MOCK > default "mock"
 */
const rawRunwareMode = (process.env.NEXT_PUBLIC_RUNWARE_MODE ??
  "") as RunwareMode

export const runwareMode: RunwareMode =
  rawRunwareMode === "real" ? "real" : "mock"

export const isRunwareMock = runwareMode === "mock"
export const isRunwareReal = runwareMode === "real"

// ============================================
// Runware Enabled Helper (R5)
// ============================================

/**
 * R5: Unified helper to check if Runware is enabled
 * 
 * Checks both server-side (RUNWARE_ENABLED) and client-side (NEXT_PUBLIC_RUNWARE_ENABLED) flags.
 * Both must be "true" for Runware to be enabled.
 * 
 * @returns true if Runware is enabled, false otherwise
 */
export function isRunwareEnabled(): boolean {
  const serverEnabled = process.env.RUNWARE_ENABLED !== "false" && process.env.RUNWARE_ENABLED !== "0"
  const clientEnabled = process.env.NEXT_PUBLIC_RUNWARE_ENABLED === "true"
  
  // Both must be true for Runware to be enabled
  return serverEnabled && clientEnabled
}

/**
 * R5: Get Runware enabled status for logging/debugging
 * 
 * @returns Object with server and client enabled flags
 */
export function getRunwareEnabledStatus() {
  return {
    serverEnabled: process.env.RUNWARE_ENABLED !== "false" && process.env.RUNWARE_ENABLED !== "0",
    clientEnabled: process.env.NEXT_PUBLIC_RUNWARE_ENABLED === "true",
    envRunwareEnabled: process.env.RUNWARE_ENABLED,
    envNextPublicRunwareEnabled: process.env.NEXT_PUBLIC_RUNWARE_ENABLED,
    isEnabled: isRunwareEnabled(),
  }
}

// ============================================
// PayPal Mode
// ============================================

/**
 * PayPal payment mode
 * Default: "mock" (for safety)
 */
const rawPaypalMode = (process.env.NEXT_PUBLIC_PAYPAL_MODE ??
  "") as PaypalMode

export const paypalMode: PaypalMode =
  rawPaypalMode === "sandbox" || rawPaypalMode === "live"
    ? rawPaypalMode
    : "mock"

export const isPaypalMock = paypalMode === "mock"
export const isPaypalSandbox = paypalMode === "sandbox"
export const isPaypalLive = paypalMode === "live"

// ============================================
// Demo Job Detection
// ============================================

/**
 * Check if a jobId is a demo job (currently only demo-001)
 * 
 * Demo jobs have special handling:
 * - Skip authentication checks
 * - Return mock data immediately
 * - Support mock checkout flow
 */
export const isDemoJob = (jobId: string | null | undefined): boolean =>
  jobId === "demo-001"

// ============================================
// Force Real Generate (Development Override)
// ============================================

/**
 * Force real generate mode (override demo/preview flags)
 * 
 * When set to true, will force Route B (real /api/generate) even if
 * isDemoMode or isPreviewEnv are true. Useful for local development
 * testing of Runware integration.
 */
export const isForceRealGenerate =
  process.env.NEXT_PUBLIC_FORCE_REAL_GENERATE === "true"


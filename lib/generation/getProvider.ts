/**
 * Provider 工廠
 * 
 * 根據環境變數返回對應的 GenerationProvider 實例
 * RUNWARE-NOTE: Uses feature flags to determine provider selection
 */

import { GenerationProvider } from "./providers/base"
import { createMockProvider } from "./providers/mock"
import { createRunwareProvider } from "./providers/runware"
import { runwareMode } from "@/lib/featureFlags"

export type ProviderType = "mock" | "runware" | "fal"

/**
 * 獲取 GenerationProvider 實例
 * 
 * RUNWARE-NOTE: Priority order:
 * 1. GENERATION_PROVIDER env var (explicit)
 * 2. runwareMode from featureFlags (NEXT_PUBLIC_RUNWARE_MODE)
 * 3. NEXT_PUBLIC_USE_MOCK (legacy, backward compatibility)
 * 4. Default: "mock" (safe default, avoid accidental real generation)
 */
export function getGenerationProvider(): GenerationProvider {
  const envProvider = process.env.GENERATION_PROVIDER?.toLowerCase()
  const useMockFlag = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  
  // 總開關檢查：如果 RUNWARE_ENABLED=false，強制使用 mock
  const runwareEnabledFlag = process.env.RUNWARE_ENABLED !== "false" && process.env.RUNWARE_ENABLED !== "0"
  
  // RUNWARE-NOTE: Use feature flags for provider selection
  // Priority: RUNWARE_ENABLED → GENERATION_PROVIDER → runwareMode → NEXT_PUBLIC_USE_MOCK → default mock
  let provider: ProviderType = "mock"
  
  if (envProvider === "mock" || envProvider === "fal") {
    provider = envProvider
  } else if (envProvider === "runware" && runwareEnabledFlag) {
    provider = "runware"
  } else if (runwareMode === "real" && runwareEnabledFlag) {
    provider = "runware"
  } else if (useMockFlag) {
    provider = "mock"
  } else {
    // Safe default: mock
    provider = "mock"
  }

  switch (provider) {
    case "mock":
      return createMockProvider()
    case "runware":
      // RUNWARE-NOTE: RunwareProvider will check template config and throw if unsupported
      return createRunwareProvider()
    case "fal":
      // TODO: 未來實作 FAL Provider
      throw new Error("FAL provider not implemented yet")
    default:
      // 安全預設：如果配置錯誤，使用 mock 模式
      return createMockProvider()
  }
}

/**
 * @deprecated 使用 getGenerationProvider() 代替
 * 保留此函數以維持向後兼容
 */
export function getProvider(): GenerationProvider {
  return getGenerationProvider()
}

/**
 * 獲取當前使用的 Provider 類型
 * 
 * RUNWARE-NOTE: Uses same logic as getGenerationProvider() for consistency
 */
export function getProviderType(): ProviderType {
  const envProvider = process.env.GENERATION_PROVIDER?.toLowerCase()
  const useMockFlag = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  
  // 總開關檢查：如果 RUNWARE_ENABLED=false，強制返回 mock
  const runwareEnabledFlag = process.env.RUNWARE_ENABLED !== "false" && process.env.RUNWARE_ENABLED !== "0"
  
  if (envProvider === "mock" || envProvider === "fal") {
    return envProvider
  }
  
  if (envProvider === "runware" && runwareEnabledFlag) {
    return "runware"
  }
  
  // RUNWARE-NOTE: Use feature flags
  if (runwareMode === "real" && runwareEnabledFlag) {
    return "runware"
  }
  
  return useMockFlag ? "mock" : "mock"
}


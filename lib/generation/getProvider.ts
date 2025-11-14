/**
 * Provider 工廠
 * 
 * 根據環境變數返回對應的 GenerationProvider 實例
 */

import { GenerationProvider } from "./providers/base"
import { createMockProvider } from "./providers/mock"
import { createRunwareProvider } from "./providers/runware"

export type ProviderType = "mock" | "runware" | "fal"

/**
 * 獲取 GenerationProvider 實例
 * 
 * 優先級：
 * 1. GENERATION_PROVIDER（明確指定）
 * 2. NEXT_PUBLIC_USE_MOCK（向後兼容）
 * 3. 預設為 "mock"（安全預設，避免意外走真生圖）
 */
export function getGenerationProvider(): GenerationProvider {
  const envProvider = process.env.GENERATION_PROVIDER?.toLowerCase()
  const useMockFlag = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  
  // 優先級：GENERATION_PROVIDER → NEXT_PUBLIC_USE_MOCK → 預設 mock
  const provider = envProvider ?? (useMockFlag ? "mock" : "mock")

  switch (provider) {
    case "mock":
      return createMockProvider()
    case "runware":
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
 */
export function getProviderType(): ProviderType {
  const envProvider = process.env.GENERATION_PROVIDER?.toLowerCase()
  const useMockFlag = process.env.NEXT_PUBLIC_USE_MOCK === "true"
  
  if (envProvider === "mock" || envProvider === "runware" || envProvider === "fal") {
    return envProvider
  }
  
  return useMockFlag ? "mock" : "mock"
}


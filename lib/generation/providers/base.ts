/**
 * Generation Provider 基礎介面
 * 
 * 定義所有 Provider 必須實作的方法
 * 對齊現有 API 契約 (docs/api/generate-contract.md)
 */

export interface GenerateRequestPayload {
  files: string[]
  style: string
  template: string
  resolution?: number
  steps?: number
  grayscale_ratio?: number
  // 保持與現有 route.ts 的相容性
  [key: string]: any
}

export interface GenerateResult {
  ok: boolean
  jobId: string
}

export interface ProgressResult {
  ok: boolean
  jobId: string
  status: "pending" | "processing" | "succeeded" | "failed"
  progress: number
  errorCode?: string
  errorMessage?: string
  // 保持與現有 API 回應格式相容
  message?: string
}

export interface ResultsResult {
  ok: boolean
  jobId: string
  images: string[]
  // 保持與現有 results route 相容（包含 paymentStatus 等）
  paymentStatus?: "free" | "paid" | "unknown"
  [key: string]: any
}

/**
 * Generation Provider 介面
 */
export interface GenerationProvider {
  name: "mock" | "runware" | "fal"
  
  /**
   * 創建生成任務
   */
  generate(input: GenerateRequestPayload): Promise<GenerateResult>

  /**
   * 查詢任務進度
   */
  getProgress(jobId: string): Promise<ProgressResult>

  /**
   * 獲取生成結果
   */
  getResults(jobId: string, options?: { paid?: boolean }): Promise<ResultsResult>
}


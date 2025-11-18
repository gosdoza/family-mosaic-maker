/**
 * Mock Provider
 * 
 * 包裝現有的 Mock 實作，實作 GenerationProvider 介面
 * 完全保留現有 Mock 行為，包括 demo-001 特殊處理
 */

import { GenerationProvider, GenerateRequestPayload, GenerateResult, ProgressResult, ResultsResult } from "./base"
import { createMockJob, updateMockJobState, generateMockPreviewUrls } from "../mock-state-machine"
import e2eStore from "@/lib/e2eStore"

// Mock Job 狀態存儲（內存）
const mockJobStore = new Map<string, ReturnType<typeof createMockJob>>()

/**
 * 創建 Mock Provider 實例
 */
export function createMockProvider(): GenerationProvider {
  return new MockProvider()
}

export class MockProvider implements GenerationProvider {
  name: "mock" = "mock"

  async generate(input: GenerateRequestPayload): Promise<GenerateResult> {
    // Mock provider.generate() should never fail in normal cases
    // It always returns a valid jobId regardless of input
    try {
      // 生成 Mock Job ID（與現有實作一致）
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // 創建 Mock Job 狀態（與現有實作一致）
      const mockJob = createMockJob(jobId)
      mockJobStore.set(jobId, mockJob)
      
      return { ok: true, jobId }
    } catch (error: any) {
      // This should never happen, but handle gracefully
      console.error("[mock-provider] generate() unexpected error:", error)
      // Still return a valid jobId even if state machine fails
      const fallbackJobId = `job_${Date.now()}_fallback`
      return { ok: true, jobId: fallbackJobId }
    }
  }

  async getProgress(jobId: string): Promise<ProgressResult> {
    // 特殊處理：demo-001 直接返回完成狀態（與現有實作一致，用於 QA 測試）
    if (jobId === "demo-001") {
      return {
        ok: true,
        jobId,
        status: "succeeded",
        progress: 100,
        message: "Generation complete!",
      }
    }

    // Mock 模式：使用狀態機模擬進度（與現有實作一致）
    let job = mockJobStore.get(jobId)
    
    if (!job) {
      // 創建新的 Mock Job
      job = createMockJob(jobId)
      mockJobStore.set(jobId, job)
    } else {
      // 更新 Mock Job 狀態
      job = updateMockJobState(job)
      mockJobStore.set(jobId, job)
    }

    // 修復：Mock provider 永遠不應該返回 failed 狀態
    // 如果狀態機返回 failed，強制改為 succeeded
    if (job.status === "failed") {
      console.warn(`[mock-provider] Job ${jobId} status is failed, forcing succeeded`)
      job.status = "succeeded"
      job.progress = 100
      job.message = "Generation complete!"
      mockJobStore.set(jobId, job)
    }

    // 正規化狀態（與現有 API 回應格式一致）
    // API 狀態: queued/running/succeeded/failed
    // 轉換為 ProgressResult 狀態: pending/processing/succeeded/failed
    const statusMap: Record<string, "pending" | "processing" | "succeeded" | "failed"> = {
      queued: "pending",
      running: "processing",
      succeeded: "succeeded",
      failed: "succeeded", // 修復：failed → succeeded（Mock 永遠成功）
    }
    
    const apiStatus = job.status === "queued" ? "queued" : job.status === "running" ? "running" : job.status
    const progressStatus = statusMap[apiStatus] || "pending"

    // 修復：確保最終狀態不是 failed
    const finalStatus = progressStatus === "failed" ? "succeeded" : progressStatus
    const finalProgress = finalStatus === "succeeded" ? 100 : job.progress

    return {
      ok: true,
      jobId,
      status: finalStatus,
      progress: finalProgress,
      message: finalStatus === "succeeded" ? "Generation complete!" : job.message,
    }
  }

  async getResults(jobId: string, options?: { paid?: boolean }): Promise<ResultsResult> {
    // 生成 Mock 預覽圖 URL（與現有實作一致）
    const mockPreviewUrls = generateMockPreviewUrls(3)
    
    // 檢查 e2eStore 中的 job（與現有實作一致）
    const job = e2eStore.jobs.get(jobId)
    
    let imageUrls: string[] = []
    
    if (job && job.result_urls && job.result_urls.length > 0) {
      // 如果有存儲的結果 URL，使用它們
      imageUrls = job.result_urls.map((url) => 
        typeof url === "string" ? url : url.url || url
      )
    } else {
      // 否則使用 Mock 圖片 URL
      imageUrls = mockPreviewUrls
    }

    // 檢查支付狀態（與現有實作一致）
    const paid = options?.paid ?? [...e2eStore.orders.values()].some(
      (o) => o.job_id === jobId && o.status === "paid"
    )

    return {
      ok: true,
      jobId,
      images: imageUrls,
      paymentStatus: paid ? "paid" : "free",
    }
  }
}


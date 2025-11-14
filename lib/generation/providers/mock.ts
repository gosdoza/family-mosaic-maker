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
    // 生成 Mock Job ID（與現有實作一致）
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // 創建 Mock Job 狀態（與現有實作一致）
    const mockJob = createMockJob(jobId)
    mockJobStore.set(jobId, mockJob)
    
    return { ok: true, jobId }
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

    // 正規化狀態（與現有 API 回應格式一致）
    // API 狀態: queued/running/succeeded/failed
    // 轉換為 ProgressResult 狀態: pending/processing/succeeded/failed
    const statusMap: Record<string, "pending" | "processing" | "succeeded" | "failed"> = {
      queued: "pending",
      running: "processing",
      succeeded: "succeeded",
      failed: "failed",
    }
    
    const apiStatus = job.status === "queued" ? "queued" : job.status === "running" ? "running" : job.status
    const progressStatus = statusMap[apiStatus] || "pending"

    return {
      ok: true,
      jobId,
      status: progressStatus,
      progress: job.progress,
      message: job.message,
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


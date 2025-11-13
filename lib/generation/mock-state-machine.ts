/**
 * Mock 生成状态机
 * 
 * 模拟生成流程：queued → running → succeeded
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed"

export interface MockJobState {
  jobId: string
  status: JobStatus
  progress: number
  message: string
  createdAt: number
  estimatedCompletion: number
}

const MOCK_DURATION_MS = 90 * 1000 // 90 秒完成

/**
 * 创建 Mock Job 状态
 */
export function createMockJob(jobId: string): MockJobState {
  return {
    jobId,
    status: "queued",
    progress: 0,
    message: "Job queued...",
    createdAt: Date.now(),
    estimatedCompletion: Date.now() + MOCK_DURATION_MS,
  }
}

/**
 * 更新 Mock Job 状态（模拟进度）
 */
export function updateMockJobState(job: MockJobState): MockJobState {
  const now = Date.now()
  const elapsed = now - job.createdAt
  const duration = MOCK_DURATION_MS

  if (elapsed < duration * 0.1) {
    // 前 10%：queued → running
    return {
      ...job,
      status: "running",
      progress: Math.floor((elapsed / duration) * 10),
      message: "Processing images...",
    }
  } else if (elapsed < duration * 0.9) {
    // 10% - 90%：running
    const progress = Math.floor(10 + ((elapsed - duration * 0.1) / (duration * 0.8)) * 80)
    return {
      ...job,
      status: "running",
      progress: Math.min(progress, 95),
      message: "Generating your family mosaic...",
    }
  } else {
    // 90%+：succeeded
    return {
      ...job,
      status: "succeeded",
      progress: 100,
      message: "Generation complete!",
    }
  }
}

/**
 * 生成 Mock 预览图 URL
 */
export function generateMockPreviewUrls(count: number = 3): string[] {
  return Array.from({ length: count }, (_, i) => {
    // 使用占位图服务或本地 mock 图片
    return `https://picsum.photos/1024/1024?random=${Date.now()}-${i}`
  })
}




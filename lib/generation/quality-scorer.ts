/**
 * 品质分数计算器（Mock）
 * 
 * 计算 CLIP 和 BRISQUE 分数
 */

export interface QualityScores {
  clip: number // 0-1，越高越好
  brisque: number // 0-100，越低越好
}

const QUALITY_THRESHOLDS = {
  CLIP_MIN: 0.85,
  BRISQUE_MAX: 40,
}

/**
 * 计算 Mock 品质分数
 * 
 * @param forceLowQuality 强制返回低品质（用于测试）
 */
export function calculateQualityScores(forceLowQuality: boolean = false): QualityScores {
  if (forceLowQuality) {
    // 强制低品质：CLIP < 0.85 或 BRISQUE > 40
    return {
      clip: 0.75 + Math.random() * 0.1, // 0.75-0.85
      brisque: 40 + Math.random() * 20, // 40-60
    }
  }

  // 正常情况：随机生成，大部分是高品质
  const isHighQuality = Math.random() > 0.2 // 80% 高品质

  if (isHighQuality) {
    return {
      clip: 0.85 + Math.random() * 0.15, // 0.85-1.0
      brisque: 10 + Math.random() * 30, // 10-40
    }
  } else {
    return {
      clip: 0.70 + Math.random() * 0.15, // 0.70-0.85
      brisque: 35 + Math.random() * 25, // 35-60
    }
  }
}

/**
 * 检查是否需要发放重生成券
 */
export function shouldIssueVoucher(scores: QualityScores): boolean {
  return scores.clip < QUALITY_THRESHOLDS.CLIP_MIN || scores.brisque > QUALITY_THRESHOLDS.BRISQUE_MAX
}

/**
 * 生成重生成券（72 小时有效）
 */
export function generateVoucher(jobId: string, userId: string) {
  const now = Date.now()
  const expiresAt = now + 72 * 60 * 60 * 1000 // 72 小时

  return {
    id: `voucher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    job_id: jobId,
    user_id: userId,
    type: "regenerate",
    expires_at: new Date(expiresAt).toISOString(),
    created_at: new Date(now).toISOString(),
    used: false,
  }
}




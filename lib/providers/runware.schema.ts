/**
 * Runware API Payload Schema
 * 
 * 最小化 schema，只验证必需字段
 */

import { z } from "zod"

/**
 * Runware API 请求 payload schema
 * 只验证最小必需字段，其他字段先标记为 optional 并 strip 掉
 */
export const RunwarePayloadSchema = z.object({
  taskType: z.string().default("imageInference"),
  prompt: z.string().min(1).max(500, "Prompt must be at most 500 characters"),
  model: z.string().default("default"),
  image_url: z.string().url().optional(),
}).strict() // 使用 strict() 来拒绝未定义的字段

/**
 * Runware API 请求类型
 */
export type RunwarePayload = z.infer<typeof RunwarePayloadSchema>

/**
 * 验证并清理 Runware payload
 * 
 * @param input 原始输入数据
 * @returns 验证后的 payload
 * @throws ZodError 如果验证失败
 */
export function validateRunwarePayload(input: unknown): RunwarePayload {
  return RunwarePayloadSchema.parse(input)
}


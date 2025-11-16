/**
 * Runware Template Configuration
 * 
 * RUNWARE-NOTE: Central config mapping (template, style) -> Runware model + prompts
 * Currently only supports "christmas" + "realistic" combination.
 * Other combinations will return null and fallback to mock provider.
 */

// RUNWARE-NOTE: Template and style types match the UI components
export type RunwareTemplateKey = {
  template: string // e.g. "christmas"
  style: string // e.g. "realistic"
}

export interface RunwareTemplateConfig {
  id: string // internal id, e.g. "christmas_realistic_v1"
  modelId: string // RUNWARE-TODO: placeholder for real Runware model id
  basePrompt: string
  negativePrompt?: string
  width: number
  height: number
}

/**
 * Resolve Runware template configuration from template + style
 * 
 * RUNWARE-NOTE: Currently only supports "christmas" + "realistic"
 * Returns null for unsupported combinations (will fallback to mock)
 */
export function resolveRunwareTemplate(
  template: string,
  style: string
): RunwareTemplateConfig | null {
  // RUNWARE-NOTE: Only support christmas + realistic for now
  if (template === "christmas" && style === "realistic") {
    return {
      id: "christmas_realistic_v1",
      modelId: "RUNWARE_MODEL_CHRISTMAS_REALISTIC_V1", // RUNWARE-TODO: replace with real model id
      basePrompt:
        "cozy family Christmas portrait in living room, warm lighting, smiling family, high detail, 4k, DSLR, bokeh background",
      negativePrompt:
        "blurry, distorted faces, extra limbs, low quality, text, watermark",
      width: 1024,
      height: 1024,
    }
  }

  // For now, we only support one combination in RunwareProvider.
  // RUNWARE-TODO: Add more template + style combinations as needed
  return null
}


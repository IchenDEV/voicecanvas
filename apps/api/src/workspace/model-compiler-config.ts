import type { ModelPatchCompilerConfig } from '@voicecanvas/ai'

export function resolveModelPatchCompilerConfig(config?: Partial<ModelPatchCompilerConfig>): ModelPatchCompilerConfig | null {
  const apiKey = config?.apiKey ?? process.env.PATCH_COMPILER_API_KEY
  const baseURL = config?.baseURL ?? process.env.PATCH_COMPILER_BASE_URL
  const model = config?.model ?? process.env.PATCH_COMPILER_MODEL
  const providerName = config?.providerName ?? process.env.PATCH_COMPILER_PROVIDER

  if (!apiKey || !baseURL || !model) {
    return null
  }

  return { apiKey, baseURL, model, providerName }
}

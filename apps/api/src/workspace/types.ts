import type { CanvasDoc, Patch, VoiceSegment } from '@voicecanvas/core'
import type { ModelPatchCompilerConfig } from '@voicecanvas/ai'

export type PatchCompilerInput = {
  segment: VoiceSegment
  canvas: CanvasDoc
  selectedObjectIds: string[]
}

export type PatchCompiler = (input: PatchCompilerInput) => Patch | Promise<Patch>

export type CreateAppOptions = {
  openaiAPIKey?: string
  openaiRealtimeModel?: string
  modelPatchCompiler?: Partial<ModelPatchCompilerConfig>
  patchCompiler?: PatchCompiler
}

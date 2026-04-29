import { z } from 'zod'
import type { CanvasDoc, Patch } from '@voicecanvas/core'

export const textSegmentRequestSchema = z.object({
  text: z.string().min(1),
  selectedObjectIds: z.array(z.string()).optional().default([]),
  provider: z.enum(['text-sim', 'openai-realtime']).optional().default('text-sim'),
})

export const patchApplyRequestSchema = z.object({
  patch: z.custom<Patch>(),
})

export const patchConfirmRequestSchema = z.object({
  candidateId: z.string().min(1),
})

export const workspaceLoadRequestSchema = z.object({
  canvas: z.custom<CanvasDoc>(),
  history: z.array(z.custom<Patch>()).default([]),
  pendingPatch: z.custom<Patch>().nullable().default(null),
})

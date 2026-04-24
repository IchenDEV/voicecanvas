import { z } from 'zod'
import type { Patch } from '@voicecanvas/core'

export const textSegmentRequestSchema = z.object({
  text: z.string().min(1),
  selectedObjectIds: z.array(z.string()).optional().default([]),
})

export const patchApplyRequestSchema = z.object({
  patch: z.custom<Patch>(),
})

export const patchConfirmRequestSchema = z.object({
  candidateId: z.string().min(1),
})

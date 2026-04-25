import { basePatch, isAmbiguous } from './mock-patch-helpers'
import {
  createFailureBackPatch,
  createNeedsConfirmPatch,
  createOtpPatch,
  createSignupFlowPatch,
} from './mock-patch-builders'
import {
  createDeleteNodePatch,
  createUpdateNodePatch,
  isDeleteIntent,
  isUpdateIntent,
} from './mock-edit-compiler'
import type { CanvasDoc, Patch, VoiceSegment } from './types'

type CompileOptions = {
  segment: VoiceSegment
  canvas: CanvasDoc
  selectedObjectIds?: string[]
}

export function compileMockPatch({ segment, canvas, selectedObjectIds = [] }: CompileOptions): Patch {
  const text = segment.finalTranscript.trim()
  const normalized = text.toLowerCase()

  if (isAmbiguous(text, selectedObjectIds)) {
    return createNeedsConfirmPatch(text, segment.id, canvas, selectedObjectIds)
  }

  if (canvas.nodes.length === 0 || normalized.includes('create')) {
    return createSignupFlowPatch(text, segment.id)
  }

  if (isDeleteIntent(normalized)) {
    return createDeleteNodePatch(text, segment.id, canvas, selectedObjectIds)
  }

  if (isUpdateIntent(normalized)) {
    return createUpdateNodePatch(text, segment.id, canvas, selectedObjectIds)
  }

  if (normalized.includes('otp') || normalized.includes('verification code') || normalized.includes('验证码')) {
    return createOtpPatch(text, segment.id, canvas)
  }

  if (normalized.includes('failure') || normalized.includes('fail') || normalized.includes('失败')) {
    return createFailureBackPatch(text, segment.id, canvas)
  }

  return basePatch(text, segment.id, [])
}

export { resolvePendingPatch } from './mock-patch-builders'
export { createTextSegment, splitTextIntoSegments } from './text-segments'

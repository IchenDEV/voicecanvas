import { basePatch, hasAmbiguousReference, isAmbiguous } from './mock-patch-helpers'
import {
  createFailureBackPatch,
  createMermaidSourcePatch,
  createNeedsConfirmPatch,
  createOtpPatch,
  createStepAfterSelectedPatch,
  createSignupFlowPatch,
} from './mock-patch-builders'
import { createMermaidSourceFromIntent, detectMermaidSource } from './mermaid-source'
import {
  createDeleteNodePatch,
  createUpdateNodePatch,
  isDeleteIntent,
  isUpdateIntent,
} from './mock-edit-compiler'
import { createMermaidSourceEditPatch } from './mermaid-source-editor'
import type { CanvasDoc, Patch, VoiceSegment } from './types'

type CompileOptions = {
  segment: VoiceSegment
  canvas: CanvasDoc
  selectedObjectIds?: string[]
}

export function compileMockPatch({ segment, canvas, selectedObjectIds = [] }: CompileOptions): Patch {
  const text = segment.finalTranscript.trim()
  const normalized = text.toLowerCase()
  const directMermaidSource = detectMermaidSource(text)
  const intendedMermaidSource = createMermaidSourceFromIntent(text)

  if (directMermaidSource) {
    return createMermaidSourcePatch(text, segment.id, directMermaidSource.diagramType, directMermaidSource.source)
  }

  if (intendedMermaidSource && (canvas.nodes.length === 0 || normalized.includes('create') || text.includes('画'))) {
    return createMermaidSourcePatch(text, segment.id, intendedMermaidSource.diagramType, intendedMermaidSource.source)
  }

  if (canvas.mermaidSource.trim() && (isDeleteIntent(normalized) || isUpdateIntent(normalized))) {
    const editPatch = createMermaidSourceEditPatch(text, segment.id, canvas)
    if (editPatch) {
      return editPatch
    }
  }

  if (hasAmbiguousReference(text) && selectedObjectIds.length > 0) {
    return createStepAfterSelectedPatch(text, segment.id, canvas, selectedObjectIds)
  }

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

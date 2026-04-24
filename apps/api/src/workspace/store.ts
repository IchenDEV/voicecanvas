import {
  applyPatch,
  compileMockPatch,
  createEmptyCanvasDoc,
  createTextSegment,
  resolvePendingPatch,
  rollbackPatch,
  splitTextIntoSegments,
  type CanvasDoc,
  type Patch,
  type VoiceSegment,
} from '@voicecanvas/core'
import { compilePatchWithModel } from '@voicecanvas/ai'
import type { CreateAppOptions } from './types'
import { resolveModelPatchCompilerConfig } from './model-compiler-config'

export function createWorkspaceStore(options: CreateAppOptions = {}) {
  let canvas: CanvasDoc = createEmptyCanvasDoc()
  let history: Patch[] = []
  let pendingPatch: Patch | null = null

  const snapshot = () => ({ canvas, history, pendingPatch })

  function reset() {
    canvas = createEmptyCanvasDoc()
    history = []
    pendingPatch = null
    return { ...snapshot(), status: 'reset' }
  }

  async function processTextInput(text: string, selectedObjectIds: string[]) {
    const segments = splitTextIntoSegments(text)
    if (segments.length === 0) {
      return { error: 'No text segment found.' } as const
    }

    const results = []
    for (const segmentText of segments) {
      const result = await processTextSegment(segmentText, selectedObjectIds)
      results.push(result)
      if (result.status === 'needs_confirm') {
        break
      }
    }
    return { ...snapshot(), results, status: results.at(-1)?.status ?? 'ignored' }
  }

  async function compileOnly(text: string, selectedObjectIds: string[]) {
    const segment = createTextSegment(text)
    const patch = await compilePatchDraft(segment, selectedObjectIds)
    return { segment, patch, canvas }
  }

  function applyDraft(patch: Patch) {
    const result = applyPatch(canvas, patch)
    if (!result.ok) {
      return { ...snapshot(), patch: result.patch, status: 'failed', reason: result.reason }
    }
    canvas = result.canvas
    history = [...history, result.patch]
    return { ...snapshot(), patch: result.patch, status: 'applied' }
  }

  function confirm(candidateId: string) {
    if (!pendingPatch) {
      return { ...snapshot(), status: 'no_pending_patch' }
    }

    const resolvedPatch = resolvePendingPatch(pendingPatch, candidateId)
    pendingPatch = null
    return applyDraft(resolvedPatch)
  }

  function undo() {
    const lastPatch = history.at(-1)
    if (!lastPatch) {
      return { ...snapshot(), status: 'no_history' }
    }

    canvas = rollbackPatch(canvas, lastPatch)
    history = history.slice(0, -1)
    pendingPatch = null
    return { ...snapshot(), patch: { ...lastPatch, status: 'rolled_back' }, status: 'undone' }
  }

  async function processTextSegment(text: string, selectedObjectIds: string[]) {
    const segment = createTextSegment(text)

    if (/\bundo\b|撤回|回退/.test(text.toLowerCase())) {
      return { segment, ...undo() }
    }

    const patch = await compilePatchDraft(segment, selectedObjectIds)
    if (patch.status === 'needs_confirm') {
      pendingPatch = patch
      return { segment, patch, status: 'needs_confirm' }
    }

    return { segment, ...applyDraft(patch) }
  }

  async function compilePatchDraft(segment: VoiceSegment, selectedObjectIds: string[]) {
    if (options.patchCompiler) {
      return options.patchCompiler({ segment, canvas, selectedObjectIds })
    }

    const config = resolveModelPatchCompilerConfig(options.modelPatchCompiler)
    if (config) {
      return compilePatchWithModel(config, {
        canvas,
        command: segment.finalTranscript,
        segmentId: segment.id,
        selectedObjectIds,
      })
    }

    return compileMockPatch({ segment, canvas, selectedObjectIds })
  }

  return { snapshot, reset, processTextInput, compileOnly, applyDraft, confirm, undo }
}

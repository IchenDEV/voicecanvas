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
  type VoiceProviderName,
  type VoiceSegment,
  type WorkspaceSnapshot,
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

  function loadSnapshot(nextSnapshot: WorkspaceSnapshot) {
    canvas = clonePlainData(nextSnapshot.canvas)
    history = clonePlainData(nextSnapshot.history)
    pendingPatch = nextSnapshot.pendingPatch ? clonePlainData(nextSnapshot.pendingPatch) : null
    return { ...snapshot(), status: 'loaded' }
  }

  async function processTextInput(text: string, selectedObjectIds: string[], provider: VoiceProviderName = 'text-sim') {
    const segments = splitTextIntoSegments(text)
    if (segments.length === 0) {
      return { error: 'No text segment found.' } as const
    }

    const results = []
    for (const segmentText of segments) {
      const result = await processTextSegment(segmentText, selectedObjectIds, provider)
      results.push(result)
      if (result.status === 'needs_confirm') {
        break
      }
    }
    const lastResult = results.at(-1)
    return { ...snapshot(), results, patch: lastResult?.patch, status: lastResult?.status ?? 'ignored' }
  }

  async function compileOnly(text: string, selectedObjectIds: string[], provider: VoiceProviderName = 'text-sim') {
    const segment = createTextSegment(text, provider)
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

  async function processTextSegment(text: string, selectedObjectIds: string[], provider: VoiceProviderName) {
    const segment = createTextSegment(text, provider)
    const candidateId = pendingPatch ? candidateIdFromConfirmationText(text, pendingPatch) : null
    if (candidateId) {
      return { segment, ...confirm(candidateId) }
    }

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

  return { snapshot, reset, loadSnapshot, processTextInput, compileOnly, applyDraft, confirm, undo }
}

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function candidateIdFromConfirmationText(text: string, patch: Patch): string | null {
  const index = confirmationIndex(text)
  if (index === null) {
    return null
  }
  return patch.targetCandidates[index]?.id ?? null
}

function confirmationIndex(text: string): number | null {
  const normalized = text.trim().toLowerCase()
  if (/\b(second|two|2)\b|第二个/.test(normalized)) {
    return 1
  }
  if (/\b(third|three|3)\b|第三个/.test(normalized)) {
    return 2
  }
  if (/\b(first|one|1)\b|第一个/.test(normalized)) {
    return 0
  }
  return null
}

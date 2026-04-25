import type { Patch } from '@voicecanvas/core'
import type { WorkspaceResponse } from './types'

type DebugAction = 'text-segment' | 'confirm-candidate' | 'undo'

export function debugRecognizedSpeech(transcript: string) {
  console.debug('[VoiceCanvas] speech', { transcript })
}

export function debugWorkspaceAction(action: DebugAction, workspace: WorkspaceResponse) {
  console.debug('[VoiceCanvas] action', {
    action,
    status: workspace.status ?? 'unknown',
    patches: patchesFrom(workspace).map(debugPatch),
    pendingCandidates: workspace.pendingPatch?.targetCandidates.map((candidate) => candidate.label) ?? [],
  })
}

function patchesFrom(workspace: WorkspaceResponse) {
  const patches = workspace.results?.flatMap((result) => (result.patch ? [result.patch] : [])) ?? []
  if (workspace.patch) {
    patches.push(workspace.patch)
  }
  return patches
}

function debugPatch(patch: Patch) {
  return {
    id: patch.id,
    sourceText: patch.sourceText,
    status: patch.status,
    ops: patch.ops.map((op) => op.type),
  }
}

import type { Patch, PatchOp } from '@voicecanvas/core'
import type { WorkspaceResponse } from './types'

type DebugAction = 'text-segment' | 'confirm-candidate' | 'undo' | 'apply-patch' | 'template'

type RealtimeDebugEvent = {
  type?: string
  transcript?: string
  command?: string
  error?: string
}

type VoiceToolDebugCall = {
  callId?: string
  name?: string
  args?: unknown
  output?: unknown
  error?: { message?: string } | string
}

export function debugRealtimeEvent(event: RealtimeDebugEvent | null) {
  if (!event || !isRelevantRealtimeEvent(event)) {
    return
  }

  withConsoleGroup('[VoiceCanvas] realtime voice event', () => {
    console.table([
      {
        type: event.type ?? '',
        transcript: event.transcript ?? '',
        command: event.command ?? '',
        error: event.error ?? '',
      },
    ])
  })
}

export function debugVoiceToolCall(phase: 'started' | 'succeeded' | 'failed', call: VoiceToolDebugCall) {
  withConsoleGroup(`[VoiceCanvas] realtime tool ${phase}`, () => {
    console.table([
      {
        phase,
        callId: call.callId ?? '',
        name: call.name ?? '',
        command: commandFromArgs(call.args),
        args: JSON.stringify(call.args ?? {}),
        output: call.output ? JSON.stringify(call.output) : '',
        error: toolErrorMessage(call.error),
      },
    ])
  })
}

export function debugRecognizedSpeech(transcript: string, selectedObjectIds: string[] = []) {
  withConsoleGroup('[VoiceCanvas] speech result', () => {
    console.table([
      {
        transcript,
        selectedObjectIds: selectedObjectIds.join(', '),
        length: transcript.length,
      },
    ])
  })
}

export function debugWorkspaceAction(action: DebugAction, workspace: WorkspaceResponse) {
  const patches = patchesFrom(workspace)
  const pendingCandidates = workspace.pendingPatch?.targetCandidates ?? []

  withConsoleGroup(`[VoiceCanvas] action result: ${action}`, () => {
    console.table([
      {
        action,
        status: workspace.status ?? 'unknown',
        diagramType: workspace.canvas.diagramType,
        canvasVersion: workspace.canvas.version,
        nodeCount: workspace.canvas.nodes.length,
        edgeCount: workspace.canvas.edges.length,
        mermaidLineCount: lineCount(workspace.canvas.mermaidSource),
        historyCount: workspace.history.length,
        pending: Boolean(workspace.pendingPatch),
      },
    ])

    if (patches.length > 0) {
      console.table(patches.map(debugPatch))
      console.table(patches.flatMap(debugPatchOps))
    }

    if (workspace.results?.some((result) => result.segment)) {
      console.table(
        workspace.results.map((result, index) => ({
          index: index + 1,
          provider: result.segment?.provider ?? '',
          transcript: result.segment?.finalTranscript ?? '',
          status: result.status ?? '',
          patchId: result.patch?.id ?? '',
        })),
      )
    }

    if (pendingCandidates.length > 0) {
      console.table(
        pendingCandidates.map((candidate, index) => ({
          index: index + 1,
          id: candidate.id,
          label: candidate.label,
          reason: candidate.reason,
          score: candidate.score,
        })),
      )
    }
  })
}

function patchesFrom(workspace: WorkspaceResponse) {
  const patches = workspace.results?.flatMap((result) => (result.patch ? [result.patch] : [])) ?? []
  if (workspace.patch) {
    patches.push(workspace.patch)
  }
  return [...new Map(patches.map((patch) => [patch.id, patch])).values()]
}

function debugPatch(patch: Patch) {
  return {
    patchId: patch.id,
    sourceText: patch.sourceText,
    status: patch.status,
    confidence: patch.confidence,
    opCount: patch.ops.length,
  }
}

function debugPatchOps(patch: Patch) {
  return patch.ops.map((op, index) => ({
    patchId: patch.id,
    opIndex: index + 1,
    type: op.type,
    target: patchOpTarget(op),
    sourcePreview: op.type === 'setMermaidSource' ? preview(op.source) : '',
    details: JSON.stringify(op),
  }))
}

function patchOpTarget(op: PatchOp) {
  switch (op.type) {
    case 'addNode':
      return op.node.id
    case 'updateNode':
    case 'deleteNode':
    case 'moveNode':
      return op.nodeId
    case 'addEdge':
      return `${op.edge.source}->${op.edge.target}`
    case 'deleteEdge':
      return op.edgeId
    case 'changeLayout':
      return op.rootNodeId
    case 'setMermaidSource':
      return op.diagramType
  }
}

function isRelevantRealtimeEvent(event: RealtimeDebugEvent) {
  return Boolean(
    event.transcript ||
      event.command ||
      event.error ||
      event.type?.startsWith('voice.') ||
      event.type?.includes('connected') ||
      event.type?.includes('committed') ||
      event.type?.includes('function_call'),
  )
}

function lineCount(source: string) {
  return source.trim() ? source.trim().split(/\r?\n/).length : 0
}

function preview(source: string) {
  return source.replace(/\s+/g, ' ').trim().slice(0, 180)
}

function commandFromArgs(args: unknown) {
  if (!args || typeof args !== 'object' || !('command' in args)) {
    return ''
  }

  const command = (args as { command?: unknown }).command
  return typeof command === 'string' ? command : ''
}

function toolErrorMessage(error: VoiceToolDebugCall['error']) {
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  return error.message ?? ''
}

function withConsoleGroup(label: string, writeLogs: () => void) {
  console.groupCollapsed(label)
  try {
    writeLogs()
  } finally {
    console.groupEnd()
  }
}

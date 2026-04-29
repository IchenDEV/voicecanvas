import { afterEach, describe, expect, it, vi } from 'vitest'
import { debugRealtimeEvent, debugRecognizedSpeech, debugVoiceToolCall, debugWorkspaceAction } from './debug-logger'
import type { WorkspaceResponse } from './types'

describe('debug logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists recognized speech in the browser debug console', () => {
    const groupCollapsed = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined)
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined)

    debugRecognizedSpeech('delete verify phone step', ['node_verify'])

    expect(groupCollapsed).toHaveBeenCalledWith('[VoiceCanvas] speech result')
    expect(table).toHaveBeenCalledWith([
      { transcript: 'delete verify phone step', selectedObjectIds: 'node_verify', length: 24 },
    ])
    expect(groupEnd).toHaveBeenCalled()
  })

  it('lists applied action and patch ops in the browser debug console', () => {
    const groupCollapsed = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined)
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined)
    const workspace: WorkspaceResponse = {
      canvas: emptyCanvas(),
      history: [],
      pendingPatch: null,
      status: 'applied',
      patch: {
        id: 'patch_1',
        sourceSegmentIds: ['segment_1'],
        sourceText: 'delete verify phone step',
        status: 'applied',
        confidence: 0.9,
        targetCandidates: [],
        createdAt: 1,
        ops: [{ type: 'deleteNode', nodeId: 'node_verify' }],
      },
    }

    debugWorkspaceAction('text-segment', workspace)

    expect(groupCollapsed).toHaveBeenCalledWith('[VoiceCanvas] action result: text-segment')
    expect(table).toHaveBeenNthCalledWith(1, [
      {
        action: 'text-segment',
        status: 'applied',
        diagramType: 'flowchart',
        canvasVersion: 0,
        nodeCount: 0,
        edgeCount: 0,
        mermaidLineCount: 0,
        historyCount: 0,
        pending: false,
      },
    ])
    expect(table).toHaveBeenNthCalledWith(2, [
      {
        patchId: 'patch_1',
        sourceText: 'delete verify phone step',
        status: 'applied',
        confidence: 0.9,
        opCount: 1,
      },
    ])
    expect(table).toHaveBeenNthCalledWith(3, [
      {
        patchId: 'patch_1',
        opIndex: 1,
        type: 'deleteNode',
        target: 'node_verify',
        sourcePreview: '',
        details: '{"type":"deleteNode","nodeId":"node_verify"}',
      },
    ])
  })

  it('lists realtime voice events that matter for speech debugging', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined)
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined)

    debugRealtimeEvent({
      type: 'input_audio_transcription.completed',
      transcript: 'add payment step',
    })

    expect(console.groupCollapsed).toHaveBeenCalledWith('[VoiceCanvas] realtime voice event')
    expect(table).toHaveBeenCalledWith([
      {
        type: 'input_audio_transcription.completed',
        transcript: 'add payment step',
        command: '',
        error: '',
      },
    ])
  })

  it('lists realtime tool calls with the command args', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined)
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined)

    debugVoiceToolCall('started', {
      callId: 'call_1',
      name: 'apply_voice_command',
      args: { command: 'delete Mermaid rendering' },
    })

    expect(table).toHaveBeenCalledWith([
      {
        phase: 'started',
        callId: 'call_1',
        name: 'apply_voice_command',
        command: 'delete Mermaid rendering',
        args: '{"command":"delete Mermaid rendering"}',
        output: '',
        error: '',
      },
    ])
  })
})

function emptyCanvas() {
  return {
    id: 'canvas_default',
    title: 'Untitled flow',
    diagramType: 'flowchart' as const,
    mermaidSource: '',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    version: 0,
    appliedPatchIds: [],
  }
}

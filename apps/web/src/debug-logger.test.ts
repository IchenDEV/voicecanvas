import { afterEach, describe, expect, it, vi } from 'vitest'
import { debugRecognizedSpeech, debugWorkspaceAction } from './debug-logger'
import type { WorkspaceResponse } from './types'

describe('debug logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints recognized speech to the browser debug console', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    debugRecognizedSpeech('delete verify phone step')

    expect(debug).toHaveBeenCalledWith('[VoiceCanvas] speech', {
      transcript: 'delete verify phone step',
    })
  })

  it('prints applied action and patch ops to the browser debug console', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
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

    expect(debug).toHaveBeenCalledWith('[VoiceCanvas] action', {
      action: 'text-segment',
      status: 'applied',
      patches: [{ id: 'patch_1', sourceText: 'delete verify phone step', status: 'applied', ops: ['deleteNode'] }],
      pendingCandidates: [],
    })
  })
})

function emptyCanvas() {
  return {
    id: 'canvas_default',
    title: 'Untitled flow',
    diagramType: 'flowchart' as const,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    version: 0,
    appliedPatchIds: [],
  }
}

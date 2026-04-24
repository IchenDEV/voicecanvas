import { describe, expect, it } from 'vitest'
import type { Patch, VoiceSegment } from '@voicecanvas/core'
import { createApp } from './app'
import { postJson } from './test-helpers'

describe('VoiceCanvas command API', () => {
  it('does not require an external model compiler key for text editing', async () => {
    const app = createApp()
    const response = await postJson(app, '/api/commands/text-segment', { text: 'create signup flow...' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('applied')
    expect(payload.canvas.nodes.some((node: { label: string }) => node.label === 'Visitor opens signup')).toBe(true)
  })

  it('uses an injected patch compiler for ordered text segments', async () => {
    const compiledCommands: string[] = []
    const app = createApp({
      patchCompiler: async ({ segment }) => {
        compiledCommands.push(segment.finalTranscript)
        return patchWithNode(segment, `Compiled: ${segment.finalTranscript}`)
      },
    })

    const response = await postJson(app, '/api/commands/text-segment', { text: 'first step... second step...' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(compiledCommands).toEqual(['first step', 'second step'])
    expect(payload.history).toHaveLength(2)
    expect(payload.canvas.nodes.map((node: { label: string }) => node.label)).toEqual([
      'Compiled: first step',
      'Compiled: second step',
    ])
  })

  it('processes continuous text segments into ordered patch history', async () => {
    const app = createApp()
    const response = await postJson(app, '/api/commands/text-segment', {
      text: 'create signup flow... add OTP after phone verification... failure goes back to phone verification...',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('applied')
    expect(payload.results).toHaveLength(3)
    expect(payload.history).toHaveLength(3)
    expect(payload.canvas.nodes.some((node: { label: string }) => node.label === 'Enter OTP code')).toBe(true)
    expect(payload.canvas.edges.some((edge: { kind: string }) => edge.kind === 'failure')).toBe(true)
  })

  it('returns candidates for ambiguous commands and applies a confirmation', async () => {
    const app = createApp()
    await postJson(app, '/api/commands/text-segment', { text: 'create signup flow...' })
    const ambiguousResponse = await postJson(app, '/api/commands/text-segment', { text: 'add a step here...' })
    const ambiguous = await ambiguousResponse.json()

    expect(ambiguous.status).toBe('needs_confirm')
    expect(ambiguous.pendingPatch.targetCandidates).toHaveLength(3)

    const candidateId = ambiguous.pendingPatch.targetCandidates[1].id
    const confirmedResponse = await postJson(app, '/api/patch/confirm', { candidateId })
    const confirmed = await confirmedResponse.json()

    expect(confirmedResponse.status).toBe(200)
    expect(confirmed.status).toBe('applied')
    expect(confirmed.pendingPatch).toBeNull()
    expect(confirmed.canvas.nodes.some((node: { label: string }) => node.label === 'New step')).toBe(true)
  })

  it('undoes the last patch and restores the previous canvas version', async () => {
    const app = createApp()
    await postJson(app, '/api/commands/text-segment', {
      text: 'create signup flow... add OTP after phone verification...',
    })

    const beforeUndo = await (await app.request('/api/canvas')).json()
    const undoResponse = await app.request('/api/patch/undo', { method: 'POST' })
    const afterUndo = await undoResponse.json()

    expect(undoResponse.status).toBe(200)
    expect(afterUndo.status).toBe('undone')
    expect(afterUndo.canvas.version).toBe(beforeUndo.canvas.version - 1)
    expect(afterUndo.history).toHaveLength(beforeUndo.history.length - 1)
  })

  it('resets the in-memory canvas for repeatable acceptance runs', async () => {
    const app = createApp()
    await postJson(app, '/api/commands/text-segment', { text: 'create signup flow...' })
    const resetResponse = await app.request('/api/dev/reset', { method: 'POST' })
    const reset = await resetResponse.json()

    expect(resetResponse.status).toBe(200)
    expect(reset.status).toBe('reset')
    expect(reset.canvas.nodes).toHaveLength(0)
    expect(reset.history).toHaveLength(0)
    expect(reset.pendingPatch).toBeNull()
  })
})

function patchWithNode(segment: VoiceSegment, label: string): Patch {
  const index = label.includes('second') ? 1 : 0
  return {
    id: `patch_${segment.id}`,
    sourceSegmentIds: [segment.id],
    sourceText: segment.finalTranscript,
    status: 'draft',
    confidence: 0.9,
    targetCandidates: [],
    createdAt: Date.now(),
    ops: [
      {
        type: 'addNode',
        node: {
          id: `node_${segment.id}`,
          type: 'process',
          label,
          position: { x: 80, y: 80 + index * 110 },
        },
      },
    ],
  }
}

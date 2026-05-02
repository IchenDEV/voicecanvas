import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  canvasToMermaid,
  compileMockPatch,
  createEmptyCanvasDoc,
  createTextSegment,
  resolvePendingPatch,
  rollbackPatch,
} from './index'
import type { Patch } from './types'

function applyOrThrow(canvas = createEmptyCanvasDoc(), patch: Patch) {
  const result = applyPatch(canvas, patch)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result
}

describe('VoiceCanvas core patch engine', () => {
  it('creates an editable signup flow from a blank canvas', () => {
    const canvas = createEmptyCanvasDoc()
    const patch = compileMockPatch({
      canvas,
      segment: createTextSegment('create signup flow'),
    })

    const result = applyOrThrow(canvas, patch)

    expect(result.canvas.nodes.map((node) => node.label)).toContain('Enter phone number')
    expect(result.canvas.edges).toHaveLength(4)
    expect(result.patch.rollback?.before.nodes).toHaveLength(0)
  })

  it('adds an OTP node without rebuilding the whole canvas', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )

    const patch = compileMockPatch({
      canvas: first.canvas,
      segment: createTextSegment('add OTP after phone verification'),
    })
    const second = applyOrThrow(first.canvas, patch)

    expect(second.canvas.nodes.some((node) => node.label === 'Enter OTP code')).toBe(true)
    expect(second.canvas.nodes.length).toBe(first.canvas.nodes.length + 1)
  })

  it('rolls back to the previous accurate canvas state', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )
    const second = applyOrThrow(
      first.canvas,
      compileMockPatch({ canvas: first.canvas, segment: createTextSegment('add OTP after phone verification') }),
    )

    const rolledBack = rollbackPatch(second.canvas, second.patch)

    expect(rolledBack.nodes).toHaveLength(first.canvas.nodes.length)
    expect(rolledBack.appliedPatchIds).toEqual(first.canvas.appliedPatchIds)
  })

  it('does not mutate the canvas when a patch contains an invalid edge', () => {
    const canvas = createEmptyCanvasDoc()
    const result = applyPatch(canvas, {
      id: 'patch_invalid',
      sourceSegmentIds: ['segment_invalid'],
      sourceText: 'bad edge',
      ops: [
        {
          type: 'addEdge',
          edge: { id: 'edge_bad', source: 'missing_a', target: 'missing_b', kind: 'default' },
        },
      ],
      targetCandidates: [],
      confidence: 0.9,
      status: 'draft',
      createdAt: Date.now(),
    })

    expect(result.ok).toBe(false)
    expect(result.canvas.nodes).toHaveLength(0)
    expect(result.canvas.edges).toHaveLength(0)
  })

  it('returns candidates instead of applying an ambiguous command', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )

    const patch = compileMockPatch({
      canvas: first.canvas,
      segment: createTextSegment('add a step here'),
    })

    expect(patch.status).toBe('needs_confirm')
    expect(patch.targetCandidates.length).toBeGreaterThan(0)
  })

  it('resolves a pending patch with a confirmed candidate', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )
    const pending = compileMockPatch({
      canvas: first.canvas,
      segment: createTextSegment('add a step here'),
    })
    const resolved = resolvePendingPatch(pending, pending.targetCandidates[1]?.id ?? pending.targetCandidates[0].id)
    const result = applyOrThrow(first.canvas, resolved)

    expect(result.canvas.nodes.some((node) => node.label === 'New step')).toBe(true)
  })

  it('renders a valid Mermaid stage-0 graph string', () => {
    const canvas = createEmptyCanvasDoc()
    const result = applyOrThrow(canvas, compileMockPatch({ canvas, segment: createTextSegment('create signup flow') }))

    expect(canvasToMermaid(result.canvas)).toContain('flowchart TD')
    expect(canvasToMermaid(result.canvas)).toContain('Enter phone number')
  })

  it('keeps empty canvas UI copy out of Mermaid output', () => {
    const source = canvasToMermaid(createEmptyCanvasDoc())

    expect(source).toBe('flowchart TD')
    expect(source).not.toContain('Start speaking to grow the graph')
  })

  it('keeps Mermaid node ids unique after id normalization', () => {
    const source = canvasToMermaid({
      ...createEmptyCanvasDoc(),
      nodes: [
        { id: 'a-b', type: 'process', label: 'A', position: { x: 0, y: 0 } },
        { id: 'a_b', type: 'process', label: 'B', position: { x: 0, y: 120 } },
      ],
      edges: [{ id: 'edge_1', source: 'a-b', target: 'a_b', kind: 'default' }],
    })

    expect(source).toContain('a_b["A"]')
    expect(source).toContain('a_b_2["B"]')
    expect(source).toContain('a_b --> a_b_2')
  })

  it('escapes Mermaid labels before rendering them as SVG HTML', () => {
    const source = canvasToMermaid({
      ...createEmptyCanvasDoc(),
      nodes: [{ id: 'node_1', type: 'process', label: 'Say "hi" <script>', position: { x: 0, y: 0 } }],
    })

    expect(source).toContain('Say \\"hi\\" &lt;script&gt;')
    expect(source).not.toContain('<script>')
  })
})

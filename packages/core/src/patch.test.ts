import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  canvasToMermaid,
  compileMockPatch,
  createEmptyCanvasDoc,
  createDiagramTemplatePatch,
  createTextSegment,
  diagramTemplates,
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

  it('moves a node through a patch and rolls back its position', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )
    const original = first.canvas.nodes.find((node) => node.id === 'node_phone')
    expect(original).toBeDefined()

    const moved = applyOrThrow(first.canvas, {
      id: 'patch_move_phone',
      sourceSegmentIds: ['segment_drag'],
      sourceText: 'drag phone step',
      ops: [{ type: 'moveNode', nodeId: 'node_phone', position: { x: 420, y: 260 } }],
      targetCandidates: [],
      confidence: 1,
      status: 'draft',
      createdAt: Date.now(),
    })

    expect(moved.canvas.nodes.find((node) => node.id === 'node_phone')?.position).toEqual({ x: 420, y: 260 })
    expect(moved.patch.rollback?.before.nodes.find((node) => node.id === 'node_phone')?.position).toEqual(
      original?.position,
    )
    expect(rollbackPatch(moved.canvas, moved.patch).nodes.find((node) => node.id === 'node_phone')?.position).toEqual(
      original?.position,
    )
  })

  it('uses a selected object as the target for an ambiguous local add command', () => {
    const first = applyOrThrow(
      createEmptyCanvasDoc(),
      compileMockPatch({ canvas: createEmptyCanvasDoc(), segment: createTextSegment('create signup flow') }),
    )
    const patch = compileMockPatch({
      canvas: first.canvas,
      segment: createTextSegment('add a step here'),
      selectedObjectIds: ['node_phone'],
    })
    const result = applyOrThrow(first.canvas, patch)

    expect(patch.status).toBe('draft')
    expect(patch.targetCandidates).toHaveLength(0)
    expect(result.canvas.edges.some((edge) => edge.source === 'node_phone')).toBe(true)
    expect(result.canvas.nodes.some((node) => node.label === 'New step')).toBe(true)
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

  it('creates a Mermaid-native mindmap from a blank canvas', () => {
    const canvas = createEmptyCanvasDoc()
    const patch = compileMockPatch({
      canvas,
      segment: createTextSegment('create a mindmap about VoiceCanvas'),
    })
    const result = applyOrThrow(canvas, patch)

    expect(result.canvas.diagramType).toBe('mindmap')
    expect(result.canvas.nodes).toHaveLength(0)
    expect(canvasToMermaid(result.canvas)).toContain('mindmap')
    expect(canvasToMermaid(result.canvas)).toContain('VoiceCanvas')
  })

  it('uses pasted Mermaid source for any Mermaid diagram type', () => {
    const canvas = createEmptyCanvasDoc()
    const patch = compileMockPatch({
      canvas,
      segment: createTextSegment('sequenceDiagram\n  Alice->>Bob: Hello'),
    })
    const result = applyOrThrow(canvas, patch)

    expect(result.canvas.diagramType).toBe('sequenceDiagram')
    expect(canvasToMermaid(result.canvas)).toBe('sequenceDiagram\n  Alice->>Bob: Hello')
  })

  it('creates Mermaid source patches from starter templates', () => {
    const template = diagramTemplates.find((candidate) => candidate.id === 'ideas')
    expect(template?.title).toBe('Ideas and structure')

    const patch = createDiagramTemplatePatch('ideas')
    expect(patch.ops).toEqual([
      {
        type: 'setMermaidSource',
        diagramType: 'mindmap',
        source: expect.stringContaining('Speech input'),
      },
    ])

    const result = applyOrThrow(createEmptyCanvasDoc(), patch)
    expect(canvasToMermaid(result.canvas)).toContain('mindmap')
    expect(canvasToMermaid(result.canvas)).toContain('Mermaid rendering')
  })

  it('can mark candidate nodes in Mermaid output without changing the default output', () => {
    const canvas = createEmptyCanvasDoc()
    const result = applyOrThrow(canvas, compileMockPatch({ canvas, segment: createTextSegment('create signup flow') }))
    const baseline = canvasToMermaid(result.canvas)
    const highlighted = canvasToMermaid(result.canvas, { highlightNodeIds: ['node_phone'] })

    expect(canvasToMermaid(result.canvas)).toBe(baseline)
    expect(highlighted).toContain('classDef voicecanvasCandidate')
    expect(highlighted).toContain('class node_phone voicecanvasCandidate')
    expect(highlighted).not.toBe(baseline)
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

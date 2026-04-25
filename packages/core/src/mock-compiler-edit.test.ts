import { describe, expect, it } from 'vitest'
import { applyPatch, compileMockPatch, createEmptyCanvasDoc, createTextSegment } from './index'
import type { CanvasDoc, Patch } from './types'

function apply(canvas: CanvasDoc, patch: Patch) {
  const result = applyPatch(canvas, patch)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.canvas
}

function signupCanvas() {
  const empty = createEmptyCanvasDoc()
  return apply(empty, compileMockPatch({ canvas: empty, segment: createTextSegment('create signup flow') }))
}

describe('mock edit compiler', () => {
  it('renames a targeted node from a natural edit command', () => {
    const canvas = signupCanvas()
    const patch = compileMockPatch({
      canvas,
      segment: createTextSegment('change phone number step to collect mobile number'),
    })

    const next = apply(canvas, patch)

    expect(patch.ops).toContainEqual({
      type: 'updateNode',
      nodeId: 'node_phone',
      label: 'Collect mobile number',
    })
    expect(next.nodes.find((node) => node.id === 'node_phone')?.label).toBe('Collect mobile number')
  })

  it('deletes a targeted node and its connected edges', () => {
    const canvas = signupCanvas()
    const patch = compileMockPatch({
      canvas,
      segment: createTextSegment('delete the verify phone step'),
    })

    const next = apply(canvas, patch)

    expect(patch.ops).toContainEqual({ type: 'deleteNode', nodeId: 'node_verify' })
    expect(next.nodes.some((node) => node.id === 'node_verify')).toBe(false)
    expect(next.edges.some((edge) => edge.source === 'node_verify' || edge.target === 'node_verify')).toBe(false)
  })
})

import { createId } from './ids'
import type { CanvasDoc, GraphNode, Patch, PatchOp } from './types'

export function basePatch(sourceText: string, segmentId: string, ops: PatchOp[]): Patch {
  return {
    id: createId('patch'),
    sourceSegmentIds: [segmentId],
    sourceText,
    ops,
    targetCandidates: [],
    confidence: ops.length > 0 ? 0.88 : 0.2,
    status: 'draft',
    createdAt: Date.now(),
  }
}

export function node(id: string, type: GraphNode['type'], label: string, order: number): GraphNode {
  return {
    id,
    type,
    label,
    position: {
      x: 80 + (order % 2) * 240,
      y: 80 + order * 110,
    },
  }
}

export function findNode(canvas: CanvasDoc, keywords: string[]): GraphNode | undefined {
  return canvas.nodes.find((candidate) =>
    keywords.some((keyword) => candidate.label.toLowerCase().includes(keyword.toLowerCase())),
  )
}

export function isAmbiguous(text: string, selectedObjectIds: string[]): boolean {
  if (selectedObjectIds.length > 0) {
    return false
  }
  return /\b(here|that|this branch|there)\b|这里|那个|这一支|这条/.test(text.toLowerCase())
}

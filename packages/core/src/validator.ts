import type { CanvasDoc, GraphEdge, GraphNode, Patch } from './types'

export type ValidationResult =
  | { ok: true }
  | {
      ok: false
      reason: string
    }

export function validateCanvasDoc(canvas: CanvasDoc): ValidationResult {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()

  for (const node of canvas.nodes) {
    if (!node.id || !node.label.trim()) {
      return { ok: false, reason: 'Every node needs an id and label.' }
    }
    if (nodeIds.has(node.id)) {
      return { ok: false, reason: `Duplicate node id: ${node.id}` }
    }
    nodeIds.add(node.id)
  }

  for (const edge of canvas.edges) {
    const edgeProblem = validateEdge(edge, nodeIds, edgeIds)
    if (edgeProblem) {
      return { ok: false, reason: edgeProblem }
    }
    edgeIds.add(edge.id)
  }

  return { ok: true }
}

export function validatePatchDraft(patch: Patch): ValidationResult {
  if (!patch.id) {
    return { ok: false, reason: 'Patch id is required.' }
  }
  if (patch.status === 'needs_confirm') {
    return patch.targetCandidates.length > 0
      ? { ok: true }
      : { ok: false, reason: 'A confirmation patch needs candidates.' }
  }
  if (patch.ops.length === 0) {
    return { ok: false, reason: 'Patch must include at least one operation.' }
  }
  return { ok: true }
}

function validateEdge(edge: GraphEdge, nodeIds: Set<string>, edgeIds: Set<string>): string | null {
  if (!edge.id) {
    return 'Every edge needs an id.'
  }
  if (edgeIds.has(edge.id)) {
    return `Duplicate edge id: ${edge.id}`
  }
  if (!nodeIds.has(edge.source)) {
    return `Edge ${edge.id} has missing source ${edge.source}.`
  }
  if (!nodeIds.has(edge.target)) {
    return `Edge ${edge.id} has missing target ${edge.target}.`
  }
  return null
}

export function findCandidateNodes(canvas: CanvasDoc, selectedObjectIds: string[]): GraphNode[] {
  const selected = selectedObjectIds
    .map((id) => canvas.nodes.find((node) => node.id === id))
    .filter((node): node is GraphNode => Boolean(node))

  if (selected.length > 0) {
    return selected.slice(0, 3)
  }

  return canvas.nodes.slice(0, 3)
}

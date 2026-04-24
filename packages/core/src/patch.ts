import { validateCanvasDoc, validatePatchDraft } from './validator'
import type { CanvasDoc, GraphEdge, GraphNode, Patch, PatchApplyResult } from './types'

export function applyPatch(canvas: CanvasDoc, patch: Patch): PatchApplyResult {
  const draftValidation = validatePatchDraft(patch)
  if (!draftValidation.ok) {
    return {
      ok: false,
      canvas,
      patch: { ...patch, status: 'failed' },
      reason: draftValidation.reason,
    }
  }

  if (patch.status === 'needs_confirm') {
    return {
      ok: false,
      canvas,
      patch,
      reason: 'Patch needs target confirmation before it can be applied.',
    }
  }

  const before = cloneCanvas(canvas)
  const next = cloneCanvas(canvas)

  for (const op of patch.ops) {
    if (op.type === 'addNode') {
      next.nodes = upsertNode(next.nodes, op.node)
      continue
    }

    if (op.type === 'updateNode') {
      next.nodes = next.nodes.map((node) =>
        node.id === op.nodeId ? { ...node, label: op.label ?? node.label } : node,
      )
      continue
    }

    if (op.type === 'deleteNode') {
      next.nodes = next.nodes.filter((node) => node.id !== op.nodeId)
      next.edges = next.edges.filter((edge) => edge.source !== op.nodeId && edge.target !== op.nodeId)
      continue
    }

    if (op.type === 'addEdge') {
      next.edges = upsertEdge(next.edges, op.edge)
      continue
    }

    if (op.type === 'deleteEdge') {
      next.edges = next.edges.filter((edge) => edge.id !== op.edgeId)
      continue
    }

    if (op.type === 'changeLayout') {
      next.nodes = layoutLocal(next.nodes, op.rootNodeId)
    }
  }

  next.version += 1
  next.appliedPatchIds = [...next.appliedPatchIds, patch.id]

  const canvasValidation = validateCanvasDoc(next)
  if (!canvasValidation.ok) {
    return {
      ok: false,
      canvas,
      patch: { ...patch, status: 'failed' },
      reason: canvasValidation.reason,
    }
  }

  return {
    ok: true,
    canvas: next,
    patch: {
      ...patch,
      status: 'applied',
      rollback: {
        before,
        appliedAt: Date.now(),
      },
    },
  }
}

export function rollbackPatch(current: CanvasDoc, patch: Patch): CanvasDoc {
  if (!patch.rollback) {
    return current
  }
  return cloneCanvas(patch.rollback.before)
}

export function cloneCanvas(canvas: CanvasDoc): CanvasDoc {
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => ({ ...node, position: { ...node.position } })),
    edges: canvas.edges.map((edge) => ({ ...edge })),
    viewport: { ...canvas.viewport },
    appliedPatchIds: [...canvas.appliedPatchIds],
  }
}

function upsertNode(nodes: GraphNode[], node: GraphNode): GraphNode[] {
  if (nodes.some((existing) => existing.id === node.id)) {
    return nodes.map((existing) => (existing.id === node.id ? node : existing))
  }
  return [...nodes, node]
}

function upsertEdge(edges: GraphEdge[], edge: GraphEdge): GraphEdge[] {
  if (edges.some((existing) => existing.id === edge.id)) {
    return edges.map((existing) => (existing.id === edge.id ? edge : existing))
  }
  return [...edges, edge]
}

function layoutLocal(nodes: GraphNode[], rootNodeId: string): GraphNode[] {
  const rootIndex = nodes.findIndex((node) => node.id === rootNodeId)
  if (rootIndex === -1) {
    return nodes
  }

  return nodes.map((node, index) => {
    if (index <= rootIndex) {
      return node
    }
    return {
      ...node,
      position: {
        x: node.position.x,
        y: rootIndex * 120 + (index - rootIndex) * 120,
      },
    }
  })
}

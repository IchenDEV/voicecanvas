import type { CanvasDoc, GraphEdge, GraphNode } from './types'

export type MermaidExportOptions = {
  highlightNodeIds?: string[]
}

export function canvasToMermaid(canvas: CanvasDoc, options: MermaidExportOptions = {}): string {
  const directSource = canvas.mermaidSource.trim()
  if (directSource) {
    return directSource
  }

  if (canvas.nodes.length === 0) {
    return 'flowchart TD'
  }

  const idMap = createMermaidIdMap(canvas.nodes)
  const nodeLines = canvas.nodes.map((node) => `  ${idMap.get(node.id) ?? safeId(node.id)}${shapeForNode(node)}`)
  const edgeLines = canvas.edges.map(
    (edge) => `  ${idMap.get(edge.source) ?? safeId(edge.source)} ${arrowForEdge(edge)} ${idMap.get(edge.target) ?? safeId(edge.target)}`,
  )
  const highlightLines = candidateHighlightLines((options.highlightNodeIds ?? []).map((id) => idMap.get(id) ?? id))

  return ['flowchart TD', ...nodeLines, ...edgeLines, ...highlightLines].join('\n')
}

function shapeForNode(node: GraphNode): string {
  const label = escapeLabel(node.label)

  if (node.type === 'start' || node.type === 'end') {
    return `(["${label}"])`
  }
  if (node.type === 'decision') {
    return `{"${label}"}`
  }
  return `["${label}"]`
}

function arrowForEdge(edge: GraphEdge): string {
  if (edge.label) {
    return `-- "${escapeLabel(edge.label)}" -->`
  }
  if (edge.kind === 'failure') {
    return '-- "failure" -->'
  }
  if (edge.kind === 'success') {
    return '-- "success" -->'
  }
  return '-->'
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_') || 'node'
}

function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function createMermaidIdMap(nodes: GraphNode[]): Map<string, string> {
  const used = new Set<string>()
  const map = new Map<string, string>()

  for (const node of nodes) {
    const base = safeId(node.id)
    let candidate = base
    let suffix = 2
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`
      suffix += 1
    }
    used.add(candidate)
    map.set(node.id, candidate)
  }

  return map
}

function candidateHighlightLines(nodeIds: string[]): string[] {
  const safeNodeIds = [...new Set(nodeIds.map(safeId))].filter(Boolean)
  if (safeNodeIds.length === 0) {
    return []
  }

  return [
    '  classDef voicecanvasCandidate fill:#fff4d6,stroke:#ff5a3d,stroke-width:3px,color:#151515;',
    ...safeNodeIds.map((id) => `  class ${id} voicecanvasCandidate`),
  ]
}

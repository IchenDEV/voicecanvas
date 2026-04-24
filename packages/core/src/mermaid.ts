import type { CanvasDoc, GraphEdge, GraphNode } from './types'

export function canvasToMermaid(canvas: CanvasDoc): string {
  if (canvas.nodes.length === 0) {
    return 'flowchart TD'
  }

  const nodeLines = canvas.nodes.map((node) => `  ${safeId(node.id)}${shapeForNode(node)}`)
  const edgeLines = canvas.edges.map((edge) => `  ${safeId(edge.source)} ${arrowForEdge(edge)} ${safeId(edge.target)}`)

  return ['flowchart TD', ...nodeLines, ...edgeLines].join('\n')
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
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"')
}

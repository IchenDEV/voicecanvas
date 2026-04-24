export type DiagramType = 'flowchart' | 'mindmap'

export type NodeType = 'start' | 'process' | 'decision' | 'end' | 'note'

export type EdgeKind = 'default' | 'success' | 'failure'

export type PatchStatus = 'draft' | 'needs_confirm' | 'applied' | 'failed' | 'rolled_back'

export type VoiceProviderName =
  | 'text-sim'
  | 'doubao-asr'

export type GraphPoint = {
  x: number
  y: number
}

export type ViewportState = {
  x: number
  y: number
  zoom: number
}

export type GraphNode = {
  id: string
  type: NodeType
  label: string
  position: GraphPoint
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  label?: string
  kind: EdgeKind
}

export type CanvasDoc = {
  id: string
  title: string
  diagramType: DiagramType
  nodes: GraphNode[]
  edges: GraphEdge[]
  viewport: ViewportState
  version: number
  appliedPatchIds: string[]
}

export type TargetCandidate = {
  id: string
  label: string
  reason: string
  score: number
}

export type RollbackRecord = {
  before: CanvasDoc
  appliedAt: number
}

export type PatchOp =
  | { type: 'addNode'; node: GraphNode; afterNodeId?: string }
  | { type: 'updateNode'; nodeId: string; label?: string }
  | { type: 'deleteNode'; nodeId: string }
  | { type: 'addEdge'; edge: GraphEdge }
  | { type: 'deleteEdge'; edgeId: string }
  | { type: 'changeLayout'; scope: 'local' | 'subtree'; rootNodeId: string }

export type Patch = {
  id: string
  sourceSegmentIds: string[]
  sourceText: string
  ops: PatchOp[]
  targetCandidates: TargetCandidate[]
  confidence: number
  status: PatchStatus
  rollback?: RollbackRecord
  createdAt: number
}

export type VoiceSegment = {
  id: string
  provider: VoiceProviderName
  finalTranscript: string
  confidence?: number
  startedAt: number
  endedAt: number
  status: 'captured' | 'queued' | 'planning' | 'done' | 'failed'
}

export type VoiceCommandEvent = {
  segmentId: string
  transcript: string
  intentType: 'create' | 'edit' | 'confirm' | 'undo' | 'cancel' | 'unknown'
  canvasId: string
  selectedObjectIds: string[]
  recentPatchIds: string[]
}

export type PatchApplyResult =
  | {
      ok: true
      canvas: CanvasDoc
      patch: Patch
    }
  | {
      ok: false
      canvas: CanvasDoc
      patch: Patch
      reason: string
    }

export function createEmptyCanvasDoc(): CanvasDoc {
  return {
    id: 'canvas_default',
    title: 'Untitled flow',
    diagramType: 'flowchart',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    version: 0,
    appliedPatchIds: [],
  }
}

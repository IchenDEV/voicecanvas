import { z } from 'zod'
import type { Patch } from '@voicecanvas/core'

const nodeTypeSchema = z.enum(['start', 'process', 'decision', 'end', 'note'])
const edgeKindSchema = z.enum(['default', 'success', 'failure'])
const patchStatusSchema = z.enum(['draft', 'needs_confirm', 'applied', 'failed', 'rolled_back'])

const graphPointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  label: z.string(),
  position: graphPointSchema,
})

const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  kind: edgeKindSchema,
})

const canvasDocSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  diagramType: z.enum(['flowchart', 'mindmap']),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  version: z.number(),
  appliedPatchIds: z.array(z.string()),
})

const patchOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addNode'),
    node: graphNodeSchema,
    afterNodeId: z.string().optional(),
  }),
  z.object({
    type: z.literal('updateNode'),
    nodeId: z.string().min(1),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('deleteNode'),
    nodeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('addEdge'),
    edge: graphEdgeSchema,
  }),
  z.object({
    type: z.literal('deleteEdge'),
    edgeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('changeLayout'),
    scope: z.enum(['local', 'subtree']),
    rootNodeId: z.string().min(1),
  }),
])

const targetCandidateSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  reason: z.string(),
  score: z.number(),
})

const patchSchema = z.object({
  id: z.string().min(1),
  sourceSegmentIds: z.array(z.string()),
  sourceText: z.string(),
  ops: z.array(patchOpSchema),
  targetCandidates: z.array(targetCandidateSchema),
  confidence: z.number(),
  status: patchStatusSchema,
  rollback: z
    .object({
      before: canvasDocSchema,
      appliedAt: z.number(),
    })
    .optional(),
  createdAt: z.number(),
}) satisfies z.ZodType<Patch>

export const textSegmentRequestSchema = z.object({
  text: z.string().min(1),
  selectedObjectIds: z.array(z.string()).optional().default([]),
})

export const patchApplyRequestSchema = z.object({
  patch: patchSchema,
})

export const patchConfirmRequestSchema = z.object({
  candidateId: z.string().min(1),
})

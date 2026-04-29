import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { CanvasDoc, Patch } from '@voicecanvas/core'

const patchOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addNode'),
    afterNodeId: z.string().optional(),
    node: z.object({
      id: z.string(),
      type: z.enum(['start', 'process', 'decision', 'end', 'note']),
      label: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  }),
  z.object({ type: z.literal('updateNode'), nodeId: z.string(), label: z.string().optional() }),
  z.object({ type: z.literal('deleteNode'), nodeId: z.string() }),
  z.object({
    type: z.literal('addEdge'),
    edge: z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      kind: z.enum(['default', 'success', 'failure']),
    }),
  }),
  z.object({ type: z.literal('deleteEdge'), edgeId: z.string() }),
  z.object({
    type: z.literal('changeLayout'),
    scope: z.enum(['local', 'subtree']),
    rootNodeId: z.string(),
  }),
  z.object({
    type: z.literal('setMermaidSource'),
    diagramType: z.string(),
    source: z.string(),
  }),
])

export const patchDraftSchema = z.object({
  id: z.string(),
  sourceSegmentIds: z.array(z.string()),
  sourceText: z.string(),
  ops: z.array(patchOpSchema),
  targetCandidates: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      reason: z.string(),
      score: z.number(),
    }),
  ),
  confidence: z.number(),
  status: z.enum(['draft', 'needs_confirm']),
  createdAt: z.number(),
}) satisfies z.ZodType<Omit<Patch, 'rollback'>>

export type ModelPatchCompilerConfig = {
  providerName?: string
  apiKey: string
  baseURL: string
  model: string
}

export async function compilePatchWithModel(config: ModelPatchCompilerConfig, input: {
  canvas: CanvasDoc
  command: string
  segmentId: string
  selectedObjectIds?: string[]
}): Promise<Patch> {
  const provider = createOpenAICompatible({
    name: config.providerName ?? 'patch-compiler',
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    includeUsage: true,
  })

  const result = await generateText({
    model: provider(config.model),
    output: Output.object({
      name: 'VoiceCanvasPatchDraft',
      description: 'A draft patch for a VoiceCanvas diagram. The model must not mutate the canvas directly.',
      schema: patchDraftSchema,
    }),
    system: [
      'You are the VoiceCanvas Patch compiler.',
      'Return only a structured Patch draft.',
      'For non-flowchart diagrams, use setMermaidSource with valid Mermaid source.',
      'When canvas.mermaidSource is present and the command deletes or renames visible text, edit that Mermaid source with setMermaidSource instead of using node ops.',
      'Never rewrite the whole graph when a local edit is enough.',
      'Use needs_confirm with targetCandidates when the target is ambiguous.',
    ].join('\n'),
    prompt: JSON.stringify({
      command: input.command,
      segmentId: input.segmentId,
      selectedObjectIds: input.selectedObjectIds ?? [],
      canvas: input.canvas,
    }),
  })

  return result.output
}

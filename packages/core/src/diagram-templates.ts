import { createId } from './ids'
import type { DiagramType, Patch } from './types'

export type DiagramTemplateId =
  | 'ideas'
  | 'process'
  | 'handoff'
  | 'schedule'
  | 'data-model'
  | 'timeline'
  | 'proportion'
  | 'system-map'

export type DiagramTemplate = {
  id: DiagramTemplateId
  title: string
  typeLabel: string
  prompt: string
  diagramType: DiagramType
  source: string
}

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'ideas',
    title: 'Ideas and structure',
    typeLabel: 'Mind map',
    prompt: 'For notes, product thinking, outlines, and loose ideas.',
    diagramType: 'mindmap',
    source: [
      'mindmap',
      '  root((VoiceCanvas))',
      '    Speech input',
      '    Mermaid rendering',
      '    Editable history',
    ].join('\n'),
  },
  {
    id: 'process',
    title: 'Step-by-step work',
    typeLabel: 'Flowchart',
    prompt: 'For user journeys, decisions, and repeatable workflows.',
    diagramType: 'flowchart',
    source: [
      'flowchart TD',
      '  start(["Start"]) --> draft["Draft first version"]',
      '  draft --> review{"Need changes?"}',
      '  review -- yes --> revise["Revise"]',
      '  revise --> review',
      '  review -- no --> done(["Done"])',
    ].join('\n'),
  },
  {
    id: 'handoff',
    title: 'Conversation or handoff',
    typeLabel: 'Sequence',
    prompt: 'For service calls, message flow, and role-by-role exchanges.',
    diagramType: 'sequenceDiagram',
    source: [
      'sequenceDiagram',
      '  participant User',
      '  participant VoiceCanvas',
      '  participant Renderer',
      '  User->>VoiceCanvas: Describe the change',
      '  VoiceCanvas->>Renderer: Produce Mermaid source',
      '  Renderer-->>User: Show updated diagram',
    ].join('\n'),
  },
  {
    id: 'schedule',
    title: 'Plan over time',
    typeLabel: 'Gantt',
    prompt: 'For project phases, deadlines, and ownership windows.',
    diagramType: 'gantt',
    source: [
      'gantt',
      '  title VoiceCanvas plan',
      '  dateFormat  YYYY-MM-DD',
      '  section Prototype',
      '  Template picker :done, 2026-04-01, 5d',
      '  Voice editing :active, 2026-04-06, 7d',
      '  Export polish :2026-04-13, 4d',
    ].join('\n'),
  },
  {
    id: 'data-model',
    title: 'Objects and fields',
    typeLabel: 'ER diagram',
    prompt: 'For entities, records, ownership, and relationships.',
    diagramType: 'erDiagram',
    source: [
      'erDiagram',
      '  CANVAS ||--o{ PATCH : has',
      '  PATCH ||--o{ OPERATION : contains',
      '  CANVAS {',
      '    string id',
      '    string diagramType',
      '    string mermaidSource',
      '  }',
      '  PATCH {',
      '    string id',
      '    string sourceText',
      '  }',
    ].join('\n'),
  },
  {
    id: 'timeline',
    title: 'Milestones and story',
    typeLabel: 'Timeline',
    prompt: 'For product history, release stages, and event sequences.',
    diagramType: 'timeline',
    source: ['timeline', '  title VoiceCanvas milestones', '  Prototype : Voice-first canvas', '  Alpha : Multi-diagram support'].join(
      '\n',
    ),
  },
  {
    id: 'proportion',
    title: 'Parts of a whole',
    typeLabel: 'Pie chart',
    prompt: 'For simple shares, effort split, or rough composition.',
    diagramType: 'pie',
    source: ['pie title VoiceCanvas focus', '  "Rendering" : 35', '  "Voice intent" : 40', '  "Export" : 25'].join('\n'),
  },
  {
    id: 'system-map',
    title: 'System pieces',
    typeLabel: 'Block diagram',
    prompt: 'For modules, surfaces, and high-level architecture.',
    diagramType: 'block',
    source: ['block-beta', '  columns 3', '  speech["Speech"] compiler["Intent"] render["Mermaid"]'].join('\n'),
  },
]

export function createDiagramTemplatePatch(templateId: DiagramTemplateId): Patch {
  const template = diagramTemplates.find((candidate) => candidate.id === templateId)
  if (!template) {
    throw new Error(`Unknown diagram template: ${templateId}`)
  }

  return {
    id: createId('patch'),
    sourceSegmentIds: [createId('segment')],
    sourceText: `Start from template: ${template.title}`,
    ops: [{ type: 'setMermaidSource', diagramType: template.diagramType, source: template.source }],
    targetCandidates: [],
    confidence: 1,
    status: 'draft',
    createdAt: Date.now(),
  }
}

import type { DiagramType } from './types'

const mermaidStarters = [
  'architecture-beta',
  'block-beta',
  'c4component',
  'c4container',
  'c4context',
  'c4dynamic',
  'classdiagram',
  'erdiagram',
  'flowchart',
  'gantt',
  'gitgraph',
  'graph',
  'journey',
  'kanban',
  'mindmap',
  'packet-beta',
  'pie',
  'quadrantchart',
  'radar-beta',
  'requirementdiagram',
  'sankey-beta',
  'sequencediagram',
  'statediagram',
  'statediagram-v2',
  'timeline',
  'treemap-beta',
  'xychart-beta',
]

export type MermaidSourceDraft = {
  diagramType: DiagramType
  source: string
}

export function detectMermaidSource(text: string): MermaidSourceDraft | null {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  const firstLine = candidate.split(/\r?\n/).find((line) => line.trim())?.trim() ?? ''
  const starter = firstLine.split(/\s+/)[0] ?? ''

  if (!isMermaidStarter(starter)) {
    return null
  }

  return {
    diagramType: diagramTypeFromStarter(starter),
    source: candidate,
  }
}

export function createMermaidSourceFromIntent(text: string): MermaidSourceDraft | null {
  const normalized = text.toLowerCase()

  if (normalized.includes('mindmap') || text.includes('思维导图')) {
    return {
      diagramType: 'mindmap',
      source: ['mindmap', '  root((VoiceCanvas))', '    Speech input', '    Mermaid rendering', '    Editable history'].join(
        '\n',
      ),
    }
  }

  if (normalized.includes('sequence diagram') || text.includes('时序图')) {
    return {
      diagramType: 'sequenceDiagram',
      source: [
        'sequenceDiagram',
        '  participant User',
        '  participant VoiceCanvas',
        '  User->>VoiceCanvas: Describe a diagram',
        '  VoiceCanvas-->>User: Render Mermaid',
      ].join('\n'),
    }
  }

  if (normalized.includes('gantt') || text.includes('甘特图')) {
    return {
      diagramType: 'gantt',
      source: ['gantt', '  title VoiceCanvas plan', '  dateFormat  YYYY-MM-DD', '  Prototype :done, 2026-04-01, 7d'].join(
        '\n',
      ),
    }
  }

  return null
}

function isMermaidStarter(starter: string) {
  return mermaidStarters.includes(starter.toLowerCase())
}

function diagramTypeFromStarter(starter: string) {
  if (starter === 'graph') {
    return 'flowchart'
  }
  return starter
}

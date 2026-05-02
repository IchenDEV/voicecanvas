import { basePatch } from './mock-patch-helpers'
import { createMermaidSourcePatch } from './mock-patch-builders'
import type { CanvasDoc, Patch } from './types'

type MermaidEditIntent =
  | { type: 'delete'; targetText: string }
  | { type: 'update'; targetText: string; nextLabel: string }

export function createMermaidSourceEditPatch(sourceText: string, segmentId: string, canvas: CanvasDoc): Patch | null {
  const source = canvas.mermaidSource.trim()
  const intent = parseMermaidEditIntent(sourceText)
  if (!source || !intent) {
    return null
  }

  const edit = editMermaidSource(source, intent)
  if (!edit) {
    return basePatch(sourceText, segmentId, [])
  }

  return createMermaidSourcePatch(sourceText, segmentId, canvas.diagramType, edit)
}

export function editMermaidSource(source: string, intent: MermaidEditIntent): string | null {
  const lines = source.split(/\r?\n/)
  const target = findBestLine(lines, intent.targetText)
  if (!target) {
    return null
  }

  if (intent.type === 'delete') {
    return lines.filter((_, index) => index !== target.index).join('\n')
  }

  return lines.map((line, index) => (index === target.index ? replaceLineLabel(line, target.label, intent.nextLabel) : line)).join('\n')
}

function parseMermaidEditIntent(text: string): MermaidEditIntent | null {
  const update = parseUpdateIntent(text)
  if (update) {
    return update
  }

  const targetText = cleanTargetText(
    text
      .replace(/\b(delete|remove|get rid of)\b/gi, ' ')
      .replace(/删除|删掉|去掉|干掉/g, ' '),
  )
  return targetText ? { type: 'delete', targetText } : null
}

function parseUpdateIntent(text: string): MermaidEditIntent | null {
  const marker =
    /\b(?:to|as|called|named)\b|改成|改为|改叫|叫做|命名为|修改为|改名为|替换成|换成/i
  const match = marker.exec(text)
  if (!match) {
    return null
  }

  const before = text.slice(0, match.index)
  const after = text.slice(match.index + match[0].length)
  const targetText = cleanTargetText(before.replace(/\b(rename|change|update|edit)\b/gi, ' ').replace(/改名|修改/g, ' '))
  const nextLabel = formatLabel(after)

  return targetText && nextLabel ? { type: 'update', targetText, nextLabel } : null
}

function cleanTargetText(text: string) {
  return text
    .replace(/^(please|the)\s+/gi, ' ')
    .replace(/\b(in|from|on)\s+(the\s+)?(image|picture|diagram|canvas)\b/gi, ' ')
    .replace(/\b(the|this|that|node|step|text|label|word|words)\b/gi, ' ')
    .replace(/把|图片中(?:的)?|图中(?:的)?|画布中(?:的)?|这个|那个|节点|步骤|文字|文案|词/g, ' ')
    .replace(/[，,。.!！?？…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatLabel(label: string) {
  const trimmed = label.replace(/[.。…]+$/g, '').replace(/^["'“”]+|["'“”]+$/g, '').trim()
  if (!trimmed) {
    return null
  }
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  return trimmed
}

function findBestLine(lines: string[], targetText: string) {
  const candidates = lines.flatMap((line, index) => {
    const label = extractLineLabel(line)
    if (!label) {
      return []
    }
    return [{ index, label, score: scoreLabelMatch(label, targetText) }]
  })
  const best = candidates.sort((a, b) => b.score - a.score)[0]
  return best && best.score >= 0.45 ? best : null
}

function extractLineLabel(line: string) {
  const trimmed = line.trim()
  if (!trimmed || isDiagramStarter(trimmed) || isConfigLine(trimmed)) {
    return null
  }

  const bracketLabel = trimmed.match(/[\[\(\{]"?([^"\]\)\}]+)"?[\]\)\}]/)
  if (bracketLabel?.[1]) {
    return bracketLabel[1].trim()
  }

  const colonLabel = trimmed.match(/:\s*([^,:]+)$/)
  if (colonLabel?.[1]) {
    return colonLabel[1].trim()
  }

  if (trimmed.startsWith('title ')) {
    return trimmed.slice('title '.length).trim()
  }

  return trimmed.replace(/^[-*]\s*/, '').trim()
}

function replaceLineLabel(line: string, label: string, nextLabel: string) {
  const index = line.indexOf(label)
  if (index >= 0) {
    return `${line.slice(0, index)}${nextLabel}${line.slice(index + label.length)}`
  }
  return line.replace(label, nextLabel)
}

function scoreLabelMatch(label: string, targetText: string) {
  const labelKey = normalizePhrase(label)
  const targetKey = normalizePhrase(targetText)
  if (!labelKey || !targetKey) {
    return 0
  }

  if (labelKey === targetKey) {
    return 1
  }
  if (labelKey.includes(targetKey) || targetKey.includes(labelKey)) {
    return 0.9
  }

  const labelTokens = tokenizeForMatch(label)
  const targetTokens = tokenizeForMatch(targetText)
  if (targetTokens.length === 0 || labelTokens.length === 0) {
    return 0
  }

  const matched = targetTokens.filter((target) => labelTokens.some((token) => token === target || fuzzyTokenMatch(token, target)))
  return matched.length / targetTokens.length
}

function normalizePhrase(value: string) {
  return tokenizeForMatch(value).join('')
}

function tokenizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .split(/\s+/)
    .map((token) => tokenAlias(token))
    .filter(Boolean)
}

function tokenAlias(token: string) {
  const aliases: Record<string, string> = {
    formate: 'mermaid',
    format: 'mermaid',
    formatted: 'mermaid',
    mermaide: 'mermaid',
    edge: 'editable',
    edit: 'editable',
    editing: 'editable',
    history: 'history',
  }
  return aliases[token] ?? token
}

function fuzzyTokenMatch(left: string, right: string) {
  if (left.length < 4 || right.length < 4) {
    return false
  }
  return levenshtein(left, right) <= 2
}

function levenshtein(left: string, right: string) {
  const distances = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = distances[0]
    distances[0] = rightIndex
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = distances[leftIndex]
      distances[leftIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous
          : Math.min(previous + 1, distances[leftIndex] + 1, distances[leftIndex - 1] + 1)
      previous = current
    }
  }
  return distances[left.length]
}

function isDiagramStarter(line: string) {
  return /^(architecture-beta|block-beta|classDiagram|erDiagram|flowchart|gantt|gitGraph|graph|journey|kanban|mindmap|pie|quadrantChart|radar-beta|requirementDiagram|sankey-beta|sequenceDiagram|stateDiagram|stateDiagram-v2|timeline|treemap-beta|xychart-beta)\b/i.test(
    line,
  )
}

function isConfigLine(line: string) {
  return /^(dateFormat|axisFormat|accTitle|accDescr)\b/i.test(line)
}

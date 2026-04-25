import { createId } from './ids'
import { basePatch } from './mock-patch-helpers'
import type { CanvasDoc, GraphNode, Patch, PatchOp } from './types'

export function isDeleteIntent(text: string) {
  return /\b(delete|remove)\b|删除|去掉|删掉/.test(text)
}

export function isUpdateIntent(text: string) {
  return /\b(rename|change|update|edit)\b|改名|修改|改成|改为/.test(text)
}

export function createDeleteNodePatch(
  sourceText: string,
  segmentId: string,
  canvas: CanvasDoc,
  selectedObjectIds: string[],
): Patch {
  const target = resolveTargetNode(canvas, targetTextForDelete(sourceText), selectedObjectIds)
  if (!target) {
    return basePatch(sourceText, segmentId, [])
  }

  return basePatch(sourceText, segmentId, deleteAndReconnectOps(canvas, target))
}

export function createUpdateNodePatch(
  sourceText: string,
  segmentId: string,
  canvas: CanvasDoc,
  selectedObjectIds: string[],
): Patch {
  const target = resolveTargetNode(canvas, targetTextForUpdate(sourceText), selectedObjectIds)
  const label = extractNewLabel(sourceText)
  const ops: PatchOp[] = target && label ? [{ type: 'updateNode', nodeId: target.id, label }] : []
  return basePatch(sourceText, segmentId, ops)
}

function targetTextForDelete(text: string) {
  return text.replace(/\b(delete|remove)\b|删除|去掉|删掉/gi, ' ')
}

function targetTextForUpdate(text: string) {
  const marker = /\b(?:to|as|called|named)\b|改成|改为|改叫|叫做|命名为|修改为|改名为/i
  return text.split(marker)[0]
}

function extractNewLabel(text: string) {
  const patterns = [
    /\b(?:to|as|called|named)\s+(.+)$/i,
    /(?:改成|改为|改叫|叫做|命名为|修改为|改名为)\s*(.+)$/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return formatLabel(match[1])
    }
  }
  return null
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

function resolveTargetNode(canvas: CanvasDoc, text: string, selectedObjectIds: string[]) {
  const normalized = text.toLowerCase()
  const matched = targetRules()
    .filter((rule) => rule.triggers.some((trigger) => normalized.includes(trigger)))
    .map((rule) => findByKeywords(canvas, rule.labels))[0]

  if (matched) {
    return matched
  }

  const selected = canvas.nodes.find((node) => selectedObjectIds.includes(node.id))
  return selected ?? canvas.nodes.at(-1) ?? null
}

function targetRules() {
  return [
    { triggers: ['otp', 'code', 'verification code', '验证码'], labels: ['otp', 'code', '验证码'] },
    { triggers: ['verify', 'verification', '验证'], labels: ['verify', 'verification', '验证'] },
    { triggers: ['phone', 'mobile', '手机号'], labels: ['phone', 'mobile', '手机号'] },
    { triggers: ['account', '账户'], labels: ['account', '账户'] },
    { triggers: ['welcome', 'done', 'screen', 'success', '成功'], labels: ['welcome', 'done', 'screen', '成功'] },
    { triggers: ['visitor', 'signup', 'start', '开始'], labels: ['visitor', 'signup', 'start', '开始'] },
  ]
}

function findByKeywords(canvas: CanvasDoc, keywords: string[]) {
  return canvas.nodes.find((node) => {
    const label = node.label.toLowerCase()
    return keywords.some((keyword) => label.includes(keyword.toLowerCase()))
  })
}

function deleteAndReconnectOps(canvas: CanvasDoc, target: GraphNode) {
  const incoming = canvas.edges.filter((edge) => edge.target === target.id)
  const outgoing = canvas.edges.filter((edge) => edge.source === target.id)
  const ops: PatchOp[] = [{ type: 'deleteNode', nodeId: target.id }]

  for (const source of incoming) {
    for (const targetEdge of outgoing) {
      if (source.source !== targetEdge.target) {
        ops.push({
          type: 'addEdge',
          edge: { id: createId('edge'), source: source.source, target: targetEdge.target, kind: targetEdge.kind },
        })
      }
    }
  }

  return ops
}

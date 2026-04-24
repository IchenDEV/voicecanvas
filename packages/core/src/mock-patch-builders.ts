import { createId } from './ids'
import { findCandidateNodes } from './validator'
import { basePatch, findNode, node } from './mock-patch-helpers'
import type { CanvasDoc, Patch, PatchOp } from './types'

export function resolvePendingPatch(patch: Patch, candidateId: string): Patch {
  const nodeId = createId('node')
  return {
    ...patch,
    status: 'draft',
    confidence: Math.max(patch.confidence, 0.8),
    targetCandidates: [],
    ops: [
      { type: 'addNode', afterNodeId: candidateId, node: newStepNode(nodeId) },
      { type: 'addEdge', edge: { id: createId('edge'), source: candidateId, target: nodeId, kind: 'default' } },
      { type: 'changeLayout', scope: 'local', rootNodeId: candidateId },
    ],
  }
}

export function createSignupFlowPatch(sourceText: string, segmentId: string): Patch {
  const start = node('node_start', 'start', 'Visitor opens signup', 0)
  const phone = node('node_phone', 'process', 'Enter phone number', 1)
  const verify = node('node_verify', 'process', 'Verify phone', 2)
  const account = node('node_account', 'process', 'Create account', 3)
  const done = node('node_done', 'end', 'Welcome screen', 4)

  return basePatch(sourceText, segmentId, [
    { type: 'addNode', node: start },
    { type: 'addNode', node: phone, afterNodeId: start.id },
    { type: 'addNode', node: verify, afterNodeId: phone.id },
    { type: 'addNode', node: account, afterNodeId: verify.id },
    { type: 'addNode', node: done, afterNodeId: account.id },
    { type: 'addEdge', edge: { id: 'edge_start_phone', source: start.id, target: phone.id, kind: 'default' } },
    { type: 'addEdge', edge: { id: 'edge_phone_verify', source: phone.id, target: verify.id, kind: 'default' } },
    { type: 'addEdge', edge: { id: 'edge_verify_account', source: verify.id, target: account.id, kind: 'default' } },
    { type: 'addEdge', edge: { id: 'edge_account_done', source: account.id, target: done.id, kind: 'success' } },
  ])
}

export function createOtpPatch(sourceText: string, segmentId: string, canvas: CanvasDoc): Patch {
  const phone = findNode(canvas, ['phone', '手机号'])
  const account = findNode(canvas, ['account'])
  const verification = findNode(canvas, ['verify', 'verification'])
  const after = verification ?? phone ?? canvas.nodes.at(-1)
  const next = account ?? canvas.nodes.find((candidate) => candidate.id !== after?.id)
  const otp = node(createId('node'), 'process', 'Enter OTP code', canvas.nodes.length)
  const ops: PatchOp[] = [{ type: 'addNode', node: otp, afterNodeId: after?.id }]

  if (after) {
    const directEdges = canvas.edges.filter((edge) => edge.source === after.id && (!next || edge.target === next.id))
    ops.push(...directEdges.map((edge) => ({ type: 'deleteEdge' as const, edgeId: edge.id })))
    ops.push({ type: 'addEdge', edge: { id: createId('edge'), source: after.id, target: otp.id, kind: 'default' } })
  }
  if (next) {
    ops.push({ type: 'addEdge', edge: { id: createId('edge'), source: otp.id, target: next.id, kind: 'success' } })
  }
  if (after) {
    ops.push({ type: 'changeLayout', scope: 'local', rootNodeId: after.id })
  }

  return basePatch(sourceText, segmentId, ops)
}

export function createFailureBackPatch(sourceText: string, segmentId: string, canvas: CanvasDoc): Patch {
  const otp = findNode(canvas, ['otp', 'code', '验证码'])
  const phone = findNode(canvas, ['phone', '手机号'])
  const source = otp ?? canvas.nodes.at(-1)
  const target = phone ?? canvas.nodes.at(0)
  const ops: PatchOp[] = source && target ? [{ type: 'addEdge', edge: failureEdge(source.id, target.id) }] : []
  return basePatch(sourceText, segmentId, ops)
}

export function createNeedsConfirmPatch(
  sourceText: string,
  segmentId: string,
  canvas: CanvasDoc,
  selectedObjectIds: string[],
): Patch {
  return {
    ...basePatch(sourceText, segmentId, []),
    status: 'needs_confirm',
    confidence: 0.42,
    targetCandidates: findCandidateNodes(canvas, selectedObjectIds).map((candidate, index) => ({
      id: candidate.id,
      label: candidate.label,
      reason: index === 0 ? 'Closest recent canvas object' : 'Possible nearby target',
      score: 0.7 - index * 0.1,
    })),
  }
}

function newStepNode(id: string) {
  return { id, type: 'process' as const, label: 'New step', position: { x: 320, y: 320 } }
}

function failureEdge(source: string, target: string) {
  return { id: createId('edge'), source, target, label: 'failure', kind: 'failure' as const }
}

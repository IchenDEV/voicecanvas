import { type RefObject } from 'react'
import { AlertCircle, Sparkles } from 'lucide-react'
import type { CanvasDoc, DiagramTemplateId, Patch } from '@voicecanvas/core'
import { DiagramTemplatePicker } from './diagram-template-picker'
import { MermaidDiagram } from './mermaid-diagram'

type CanvasStageProps = {
  canvas: CanvasDoc | null
  mermaidSource: string
  pendingPatch: Patch | null
  selectedObjectIds: string[]
  canvasRef: RefObject<HTMLDivElement | null>
  onSelectObject: (objectId: string | null) => void
  onStartTemplate: (templateId: DiagramTemplateId) => void
  onConfirmCandidate: (candidateId: string) => void
}

export function CanvasStage({
  canvas,
  mermaidSource,
  pendingPatch,
  selectedObjectIds,
  canvasRef,
  onSelectObject,
  onStartTemplate,
  onConfirmCandidate,
}: CanvasStageProps) {
  const hasNodes = Boolean(canvas?.nodes.length)
  const hasMermaidSource = Boolean(canvas?.mermaidSource.trim())
  const hasDiagram = Boolean(canvas && (hasNodes || hasMermaidSource))
  const selectedLabel =
    canvas?.nodes.find((node) => selectedObjectIds.includes(node.id))?.label ??
    pendingPatch?.targetCandidates.find((candidate) => selectedObjectIds.includes(candidate.id))?.label

  return (
    <section className="canvas-stage" aria-label="Diagram canvas">
      <div className="canvas-grid" />
      <div className="canvas-shell">
        {canvas && hasDiagram ? (
          <MermaidDiagram
            ref={canvasRef}
            source={mermaidSource}
            version={canvas.version}
            nodeIds={canvas.nodes.map((node) => node.id)}
            onSelectNode={onSelectObject}
          />
        ) : null}
        {!hasDiagram ? (
          <div className="empty-canvas">
            <Sparkles size={20} />
            <DiagramTemplatePicker onStartTemplate={onStartTemplate} />
          </div>
        ) : null}
      </div>

      {selectedLabel ? <div className="selection-chip">Selected: {selectedLabel}</div> : null}

      {pendingPatch ? (
        <div className="confirmation-popover">
          <div className="confirmation-title">
            <AlertCircle size={16} />
            <span>Which node did you mean?</span>
          </div>
          <div className="candidate-list">
            {pendingPatch.targetCandidates.map((candidate, index) => (
              <button key={candidate.id} type="button" onClick={() => onConfirmCandidate(candidate.id)}>
                <span>{index + 1}</span>
                <strong>{candidate.label}</strong>
                <small>{candidate.reason}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

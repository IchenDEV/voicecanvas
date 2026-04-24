import { AlertCircle, Sparkles } from 'lucide-react'
import type { CanvasDoc, Patch } from '@voicecanvas/core'
import { MermaidDiagram } from './mermaid-diagram'

type CanvasStageProps = {
  canvas: CanvasDoc | null
  mermaidSource: string
  pendingPatch: Patch | null
  onConfirmCandidate: (candidateId: string) => void
}

export function CanvasStage({ canvas, mermaidSource, pendingPatch, onConfirmCandidate }: CanvasStageProps) {
  const hasNodes = Boolean(canvas?.nodes.length)

  return (
    <section className="canvas-stage" aria-label="Diagram canvas">
      <div className="canvas-grid" />
      <div className="canvas-shell">
        {canvas && hasNodes ? <MermaidDiagram source={mermaidSource} version={canvas.version} /> : null}
        {!hasNodes ? (
          <div className="empty-canvas">
            <Sparkles size={20} />
            <p>Start speaking. The graph will grow here.</p>
          </div>
        ) : null}
      </div>

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

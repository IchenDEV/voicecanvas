import { Check, History } from 'lucide-react'
import type { Patch } from '@voicecanvas/core'

type HistorySheetProps = {
  history: Patch[]
}

export function HistorySheet({ history }: HistorySheetProps) {
  return (
    <aside id="patch-history-panel" className="history-sheet" aria-label="Patch history">
      <div className="sheet-title">
        <History size={16} />
        <span>Version history</span>
      </div>
      <div className="history-list">
        {history.length === 0 ? <p className="history-empty">No patches yet.</p> : <HistoryItems history={history} />}
      </div>
    </aside>
  )
}

function HistoryItems({ history }: HistorySheetProps) {
  return history
    .slice()
    .reverse()
    .slice(0, 8)
    .map((patch) => (
      <article key={patch.id} className="history-item">
        <div>
          <Check size={14} />
          <span>{patch.status}</span>
        </div>
        <p>{patch.sourceText}</p>
        <small>{patch.ops.length} ops</small>
      </article>
    ))
}

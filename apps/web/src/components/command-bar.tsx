import { Download, History, Sparkles, Undo2 } from 'lucide-react'

type CommandBarProps = {
  isHistoryOpen: boolean
  status: string
  onToggleHistory: () => void
  onUndo: () => void
}

export function CommandBar({ isHistoryOpen, status, onToggleHistory, onUndo }: CommandBarProps) {
  return (
    <header className="command-bar" aria-label="VoiceCanvas command bar">
      <div className="brand-lockup">
        <img className="brand-mark" src="/brand/voicecanvas-mark.svg" alt="" aria-hidden="true" />
        <span>VoiceCanvas</span>
      </div>
      <div className="command-status">
        <Sparkles size={16} />
        <span>{status}</span>
      </div>
      <div className="command-actions">
        <button type="button" className="icon-button" onClick={onUndo} aria-label="Undo last patch">
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          className={isHistoryOpen ? 'icon-button is-active' : 'icon-button'}
          onClick={onToggleHistory}
          aria-label={isHistoryOpen ? 'Close version history' : 'Open version history'}
          aria-controls="patch-history-panel"
          aria-expanded={isHistoryOpen}
        >
          <History size={17} />
        </button>
        <a className="icon-button" href="/api/export/json" aria-label="Export JSON">
          <Download size={17} />
        </a>
      </div>
    </header>
  )
}

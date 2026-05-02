import { Download, FileJson, History, Undo2 } from 'lucide-react'
import type { DiagramFile } from '../files/diagram-files'
import { FileLibraryMenu } from './file-library-menu'

type CommandBarProps = {
  isHistoryOpen: boolean
  activeFile: DiagramFile | null
  diagramFiles: DiagramFile[]
  onCreateDiagram: () => void
  onOpenDiagram: (fileId: string) => void
  onRenameDiagram: (fileId: string, name: string) => void
  onDeleteDiagram: (fileId: string) => void
  onToggleHistory: () => void
  onUndo: () => void
  onExportPng: () => void
}

export function CommandBar({
  isHistoryOpen,
  activeFile,
  diagramFiles,
  onCreateDiagram,
  onOpenDiagram,
  onRenameDiagram,
  onDeleteDiagram,
  onToggleHistory,
  onUndo,
  onExportPng,
}: CommandBarProps) {
  return (
    <header className="command-bar" aria-label="VoiceCanvas command bar">
      <div className="command-left">
        <FileLibraryMenu
          activeFile={activeFile}
          files={diagramFiles}
          onCreate={onCreateDiagram}
          onOpen={onOpenDiagram}
          onRename={onRenameDiagram}
          onDelete={onDeleteDiagram}
        />
      </div>
      <div className="brand-lockup command-brand">
        <img className="brand-mark" src="/brand/voicecanvas-mark.svg" alt="" aria-hidden="true" />
        <span>VoiceCanvas</span>
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
        <button type="button" className="icon-button" onClick={onExportPng} aria-label="Export PNG">
          <Download size={17} />
        </button>
        <a className="icon-button" href="/api/export/json" aria-label="Export JSON">
          <FileJson size={17} />
        </a>
      </div>
    </header>
  )
}

import { useCallback, useMemo, useRef, useState } from 'react'
import { CanvasStage } from './components/canvas-stage'
import { CommandBar } from './components/command-bar'
import { HistorySheet } from './components/history-sheet'
import { VoiceCapsule } from './components/voice-capsule'
import { exportCanvasPng } from './export/export-canvas'
import { useMermaidConfig } from './hooks/use-mermaid-config'
import { useOpenAIRealtimeVoice } from './hooks/use-openai-realtime-voice'
import { useWorkspace } from './hooks/use-workspace'
import './styles/base.css'
import './styles/command-bar.css'
import './styles/canvas.css'
import './styles/history.css'
import './styles/voice.css'
import './styles/responsive.css'

function App() {
  useMermaidConfig()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([])
  const canvasExportRef = useRef<HTMLDivElement | null>(null)
  const {
    canvas,
    history,
    mermaidSource,
    pendingPatch,
    activeFile,
    diagramFiles,
    status,
    setStatus,
    sendTextSegment,
    confirmCandidate,
    undoLastPatch,
    startFromTemplate,
    createNewDiagram,
    openDiagram,
    renameDiagram,
    deleteDiagram,
  } = useWorkspace()
  const currentSelection = useMemo(
    () => selectedObjectIds.filter((id) => canvas?.nodes.some((node) => node.id === id)),
    [canvas, selectedObjectIds],
  )

  const handleVoiceCommand = useCallback(
    async (command: string) => {
      await sendTextSegment(command, currentSelection, true, 'openai-realtime')
    },
    [currentSelection, sendTextSegment],
  )

  const mic = useOpenAIRealtimeVoice({ onCommand: handleVoiceCommand, setStatus })
  const visibleStatus = pendingPatch ? 'Confirmation needed' : mic.status ?? status

  const handleUndo = useCallback(() => {
    void undoLastPatch(mic.isRealtimeActive)
  }, [mic.isRealtimeActive, undoLastPatch])

  const handleConfirmCandidate = useCallback(
    (candidateId: string) => {
      void confirmCandidate(candidateId, mic.isRealtimeActive)
    },
    [confirmCandidate, mic.isRealtimeActive],
  )
  const handleExportPng = useCallback(() => {
    if (!canvasExportRef.current) {
      setStatus('No canvas to export')
      return
    }
    void exportCanvasPng(canvasExportRef.current, 'voicecanvas.png').catch(() => setStatus('Export failed'))
  }, [setStatus])

  return (
    <main className={isHistoryOpen ? 'workbench is-history-open' : 'workbench'}>
      <CommandBar
        isHistoryOpen={isHistoryOpen}
        activeFile={activeFile}
        diagramFiles={diagramFiles}
        onCreateDiagram={createNewDiagram}
        onOpenDiagram={openDiagram}
        onRenameDiagram={renameDiagram}
        onDeleteDiagram={deleteDiagram}
        onToggleHistory={() => setIsHistoryOpen((value) => !value)}
        onUndo={handleUndo}
        onExportPng={handleExportPng}
      />
      <CanvasStage
        canvas={canvas}
        mermaidSource={mermaidSource}
        pendingPatch={pendingPatch}
        selectedObjectIds={currentSelection}
        canvasRef={canvasExportRef}
        onSelectObject={(objectId) => setSelectedObjectIds(objectId ? [objectId] : [])}
        onStartTemplate={startFromTemplate}
        onConfirmCandidate={handleConfirmCandidate}
      />
      {isHistoryOpen ? <HistorySheet history={history} /> : null}
      <VoiceCapsule isRealtimeActive={mic.isRealtimeActive} status={visibleStatus} onToggle={mic.toggleRealtimeMic} />
    </main>
  )
}

export default App

import { useCallback, useState } from 'react'
import { CanvasStage } from './components/canvas-stage'
import { CommandBar } from './components/command-bar'
import { HistorySheet } from './components/history-sheet'
import { VoiceCapsule } from './components/voice-capsule'
import { useDoubaoMic } from './hooks/use-doubao-mic'
import { useMermaidConfig } from './hooks/use-mermaid-config'
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
  const {
    canvas,
    history,
    pendingPatch,
    mermaidSource,
    status,
    setStatus,
    sendTextSegment,
    confirmCandidate,
    undoLastPatch,
  } = useWorkspace()

  const handleTranscript = useCallback(
    async (transcript: string) => {
      await sendTextSegment(transcript, [], true)
    },
    [sendTextSegment],
  )

  const mic = useDoubaoMic({ onTranscript: handleTranscript, setStatus })
  const visibleStatus = pendingPatch ? 'Confirmation needed' : status

  const handleUndo = useCallback(() => {
    void undoLastPatch(mic.isRealtimeActive)
  }, [mic.isRealtimeActive, undoLastPatch])

  const handleConfirmCandidate = useCallback(
    (candidateId: string) => {
      void confirmCandidate(candidateId, mic.isRealtimeActive)
    },
    [confirmCandidate, mic.isRealtimeActive],
  )

  return (
    <main className={isHistoryOpen ? 'workbench is-history-open' : 'workbench'}>
      <CommandBar
        isHistoryOpen={isHistoryOpen}
        status={visibleStatus}
        onToggleHistory={() => setIsHistoryOpen((value) => !value)}
        onUndo={handleUndo}
      />
      <CanvasStage
        canvas={canvas}
        mermaidSource={mermaidSource}
        pendingPatch={pendingPatch}
        onConfirmCandidate={handleConfirmCandidate}
      />
      {isHistoryOpen ? <HistorySheet history={history} /> : null}
      <VoiceCapsule isRealtimeActive={mic.isRealtimeActive} status={visibleStatus} onToggle={mic.toggleRealtimeMic} />
    </main>
  )
}

export default App

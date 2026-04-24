import { useCallback, useEffect, useMemo, useState } from 'react'
import { canvasToMermaid, type CanvasDoc, type Patch } from '@voicecanvas/core'
import type { WorkspaceResponse } from '../types'

export function useWorkspace() {
  const [canvas, setCanvas] = useState<CanvasDoc | null>(null)
  const [history, setHistory] = useState<Patch[]>([])
  const [pendingPatch, setPendingPatch] = useState<Patch | null>(null)
  const [status, setStatus] = useState('Ready')
  const mermaidSource = useMemo(() => (canvas ? canvasToMermaid(canvas) : ''), [canvas])

  const applyWorkspace = useCallback((workspace: WorkspaceResponse) => {
    setCanvas(workspace.canvas)
    setHistory(workspace.history)
    setPendingPatch(workspace.pendingPatch)
  }, [])

  const sendTextSegment = useCallback(
    async (text: string, selectedObjectIds: string[] = [], keepListening = false) => {
      if (!text.trim()) {
        return null
      }

      setStatus('Planning')
      try {
        const response = await fetch('/api/commands/text-segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, selectedObjectIds }),
        })
        const workspace = (await response.json()) as WorkspaceResponse
        applyWorkspace(workspace)
        setStatus(workspace.status === 'needs_confirm' ? 'Which node did you mean?' : idleStatus(keepListening))
        return workspace
      } catch {
        setStatus('Connection issue')
        return null
      }
    },
    [applyWorkspace],
  )

  const confirmCandidate = useCallback(
    async (candidateId: string, keepListening = false) => {
      setStatus('Refining this branch')
      try {
        const response = await fetch('/api/patch/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId }),
        })
        const workspace = (await response.json()) as WorkspaceResponse
        applyWorkspace(workspace)
        setStatus(idleStatus(keepListening))
        return workspace
      } catch {
        setStatus('Connection issue')
        return null
      }
    },
    [applyWorkspace],
  )

  const undoLastPatch = useCallback(
    async (keepListening = false) => {
      setStatus('Reverting')
      try {
        const response = await fetch('/api/patch/undo', { method: 'POST' })
        const workspace = (await response.json()) as WorkspaceResponse
        applyWorkspace(workspace)
        setStatus(idleStatus(keepListening))
        return workspace
      } catch {
        setStatus('Connection issue')
        return null
      }
    },
    [applyWorkspace],
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/canvas')
      .then((response) => response.json())
      .then((workspace: WorkspaceResponse) => {
        if (!cancelled) {
          applyWorkspace(workspace)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('Connection issue')
        }
      })
    return () => {
      cancelled = true
    }
  }, [applyWorkspace])

  return { canvas, history, pendingPatch, mermaidSource, status, setStatus, sendTextSegment, confirmCandidate, undoLastPatch }
}

function idleStatus(keepListening: boolean) {
  return keepListening ? 'Listening' : 'Ready'
}

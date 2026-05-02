import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  canvasToMermaid,
  createDiagramTemplatePatch,
  type CanvasDoc,
  type DiagramTemplateId,
  type Patch,
  type VoiceProviderName,
  type WorkspaceSnapshot,
} from '@voicecanvas/core'
import type { WorkspaceResponse } from '../types'
import { debugRecognizedSpeech, debugWorkspaceAction } from '../debug-logger'
import {
  createBlankDiagramFile,
  createDiagramFileFromWorkspace,
  emptyDiagramLibrary,
  loadDiagramLibrary,
  nextUntitledDiagramName,
  renameDiagramFile,
  saveDiagramLibrary,
  shouldPreferApiWorkspace,
  updateActiveWorkspace,
  workspaceFromResponse,
  type DiagramFile,
  type DiagramLibrary,
} from '../files/diagram-files'

export function useWorkspace() {
  const [library, setLibrary] = useState<DiagramLibrary>(() => loadDiagramLibrary() ?? emptyDiagramLibrary())
  const [canvas, setCanvas] = useState<CanvasDoc | null>(null)
  const [history, setHistory] = useState<Patch[]>([])
  const [pendingPatch, setPendingPatch] = useState<Patch | null>(null)
  const [status, setStatus] = useState('Ready')
  const activeFile = useMemo(
    () => library.files.find((file) => file.id === library.activeFileId) ?? library.files[0] ?? null,
    [library],
  )
  const highlightedCandidateIds = useMemo(
    () => pendingPatch?.targetCandidates.map((candidate) => candidate.id) ?? [],
    [pendingPatch],
  )
  const mermaidSource = useMemo(
    () => (canvas ? canvasToMermaid(canvas, { highlightNodeIds: highlightedCandidateIds }) : ''),
    [canvas, highlightedCandidateIds],
  )

  const showWorkspace = useCallback((workspace: WorkspaceSnapshot) => {
    setCanvas(workspace.canvas)
    setHistory(workspace.history)
    setPendingPatch(workspace.pendingPatch)
  }, [])

  const replaceLibrary = useCallback((nextLibrary: DiagramLibrary) => {
    saveDiagramLibrary(nextLibrary)
    setLibrary(nextLibrary)
  }, [])

  const updateLibrary = useCallback((updater: (current: DiagramLibrary) => DiagramLibrary) => {
    setLibrary((current) => {
      const next = updater(current)
      saveDiagramLibrary(next)
      return next
    })
  }, [])

  const syncWorkspaceToApi = useCallback(async (workspace: WorkspaceSnapshot) => {
    await fetch('/api/workspace/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace),
    })
  }, [])

  const applyWorkspace = useCallback(
    (workspace: WorkspaceResponse) => {
      const snapshot = workspaceFromResponse(workspace)
      showWorkspace(snapshot)
      updateLibrary((current) => updateActiveWorkspace(current, snapshot))
    },
    [showWorkspace, updateLibrary],
  )

  const sendTextSegment = useCallback(
    async (
      text: string,
      selectedObjectIds: string[] = [],
      keepListening = false,
      provider: VoiceProviderName = 'text-sim',
    ) => {
      if (!text.trim()) {
        return null
      }

      setStatus('Planning')
      debugRecognizedSpeech(text, selectedObjectIds)
      try {
        const response = await fetch('/api/commands/text-segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, selectedObjectIds, provider }),
        })
        const workspace = (await response.json()) as WorkspaceResponse
        debugWorkspaceAction('text-segment', workspace)
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
        debugWorkspaceAction('confirm-candidate', workspace)
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
        debugWorkspaceAction('undo', workspace)
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

  const startFromTemplate = useCallback(
    async (templateId: DiagramTemplateId) => {
      setStatus('Starting template')
      try {
        const response = await fetch('/api/patch/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: createDiagramTemplatePatch(templateId) }),
        })
        const workspace = (await response.json()) as WorkspaceResponse
        debugWorkspaceAction('template', workspace)
        applyWorkspace(workspace)
        setStatus(workspace.status === 'failed' ? 'Template failed' : 'Ready')
        return workspace
      } catch {
        setStatus('Connection issue')
        return null
      }
    },
    [applyWorkspace],
  )

  const createNewDiagram = useCallback(() => {
    const file = createBlankDiagramFile(nextUntitledDiagramName(library.files))
    const nextLibrary = { activeFileId: file.id, files: [file, ...library.files] }
    replaceLibrary(nextLibrary)
    showWorkspace(file.workspace)
    setStatus('Ready')
    void syncWorkspaceToApi(file.workspace).catch(() => setStatus('Connection issue'))
  }, [library.files, replaceLibrary, showWorkspace, syncWorkspaceToApi])

  const openDiagram = useCallback(
    (fileId: string) => {
      const file = library.files.find((item) => item.id === fileId)
      if (!file) {
        return
      }

      replaceLibrary({ ...library, activeFileId: file.id })
      showWorkspace(file.workspace)
      setStatus('Ready')
      void syncWorkspaceToApi(file.workspace).catch(() => setStatus('Connection issue'))
    },
    [library, replaceLibrary, showWorkspace, syncWorkspaceToApi],
  )

  const renameDiagram = useCallback(
    (fileId: string, nextName: string) => {
      const nextLibrary = renameDiagramFile(library, fileId, nextName)
      const nextActiveFile = activeDiagramFile(nextLibrary)
      replaceLibrary(nextLibrary)
      if (nextActiveFile?.id === fileId) {
        showWorkspace(nextActiveFile.workspace)
        void syncWorkspaceToApi(nextActiveFile.workspace).catch(() => setStatus('Connection issue'))
      }
    },
    [library, replaceLibrary, showWorkspace, syncWorkspaceToApi],
  )

  const deleteDiagram = useCallback(
    (fileId: string) => {
      const remainingFiles = library.files.filter((file) => file.id !== fileId)
      const nextActiveFile =
        remainingFiles.find((file) => file.id === library.activeFileId) ??
        remainingFiles[0] ??
        createBlankDiagramFile(nextUntitledDiagramName([]))
      const nextLibrary = {
        activeFileId: nextActiveFile.id,
        files: remainingFiles.length > 0 ? remainingFiles : [nextActiveFile],
      }
      replaceLibrary(nextLibrary)
      showWorkspace(nextActiveFile.workspace)
      setStatus('Ready')
      void syncWorkspaceToApi(nextActiveFile.workspace).catch(() => setStatus('Connection issue'))
    },
    [library, replaceLibrary, showWorkspace, syncWorkspaceToApi],
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/canvas')
      .then((response) => response.json())
      .then((workspace: WorkspaceResponse) => {
        if (cancelled) {
          return
        }

        const apiWorkspace = workspaceFromResponse(workspace)
        const storedLibrary = loadDiagramLibrary()
        if (storedLibrary) {
          const storedActiveFile = activeDiagramFile(storedLibrary)
          if (storedActiveFile && shouldPreferApiWorkspace(apiWorkspace, storedActiveFile.workspace)) {
            const nextLibrary = updateActiveWorkspace(storedLibrary, apiWorkspace)
            replaceLibrary(nextLibrary)
            showWorkspace(activeDiagramFile(nextLibrary)?.workspace ?? apiWorkspace)
            return
          }

          replaceLibrary(storedLibrary)
          const activeWorkspace = storedActiveFile?.workspace ?? storedLibrary.files[0].workspace
          showWorkspace(activeWorkspace)
          void syncWorkspaceToApi(activeWorkspace).catch(() => setStatus('Connection issue'))
          return
        }

        const firstFile = createDiagramFileFromWorkspace(apiWorkspace)
        replaceLibrary({ activeFileId: firstFile.id, files: [firstFile] })
        showWorkspace(firstFile.workspace)
      })
      .catch(() => {
        const storedLibrary = loadDiagramLibrary()
        const storedActiveFile = storedLibrary ? activeDiagramFile(storedLibrary) : null
        if (!cancelled && storedLibrary && storedActiveFile) {
          replaceLibrary(storedLibrary)
          showWorkspace(storedActiveFile.workspace)
          return
        }
        if (!cancelled) {
          setStatus('Connection issue')
        }
      })
    return () => {
      cancelled = true
    }
  }, [replaceLibrary, showWorkspace, syncWorkspaceToApi])

  return {
    canvas,
    history,
    pendingPatch,
    mermaidSource,
    diagramFiles: library.files,
    activeFile,
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
  }
}

function activeDiagramFile(library: DiagramLibrary): DiagramFile | null {
  return library.files.find((file) => file.id === library.activeFileId) ?? library.files[0] ?? null
}

function idleStatus(keepListening: boolean) {
  return keepListening ? 'Listening' : 'Ready'
}

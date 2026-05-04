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

type WorkspaceAction = Parameters<typeof debugWorkspaceAction>[0]
type WorkspaceStatusResolver = (workspace: WorkspaceResponse) => string

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

  const syncWorkspace = useCallback(
    (workspace: WorkspaceSnapshot) => {
      void fetch('/api/workspace/load', jsonPost(workspace)).catch(() => setStatus('Connection issue'))
    },
    [],
  )

  const applyWorkspace = useCallback(
    (workspace: WorkspaceResponse) => {
      const snapshot = workspaceFromResponse(workspace)
      showWorkspace(snapshot)
      updateLibrary((current) => updateActiveWorkspace(current, snapshot))
    },
    [showWorkspace, updateLibrary],
  )

  const runWorkspaceRequest = useCallback(
    async (
      path: string,
      init: RequestInit,
      action: WorkspaceAction,
      statusFromWorkspace: WorkspaceStatusResolver,
    ) => {
      try {
        const response = await fetch(path, init)
        const workspace = (await response.json()) as WorkspaceResponse
        debugWorkspaceAction(action, workspace)
        applyWorkspace(workspace)
        setStatus(statusFromWorkspace(workspace))
        return workspace
      } catch {
        setStatus('Connection issue')
        return null
      }
    },
    [applyWorkspace],
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
      return runWorkspaceRequest(
        '/api/commands/text-segment',
        jsonPost({ text, selectedObjectIds, provider }),
        'text-segment',
        (workspace) => (workspace.status === 'needs_confirm' ? 'Which node did you mean?' : idleStatus(keepListening)),
      )
    },
    [runWorkspaceRequest],
  )

  const confirmCandidate = useCallback(
    async (candidateId: string, keepListening = false) => {
      setStatus('Refining this branch')
      return runWorkspaceRequest(
        '/api/patch/confirm',
        jsonPost({ candidateId }),
        'confirm-candidate',
        () => idleStatus(keepListening),
      )
    },
    [runWorkspaceRequest],
  )

  const undoLastPatch = useCallback(
    async (keepListening = false) => {
      setStatus('Reverting')
      return runWorkspaceRequest('/api/patch/undo', { method: 'POST' }, 'undo', () => idleStatus(keepListening))
    },
    [runWorkspaceRequest],
  )

  const startFromTemplate = useCallback(
    async (templateId: DiagramTemplateId) => {
      setStatus('Starting template')
      return runWorkspaceRequest(
        '/api/patch/apply',
        jsonPost({ patch: createDiagramTemplatePatch(templateId) }),
        'template',
        (workspace) => (workspace.status === 'failed' ? 'Template failed' : 'Ready'),
      )
    },
    [runWorkspaceRequest],
  )

  const createNewDiagram = useCallback(() => {
    const file = createBlankDiagramFile(nextUntitledDiagramName(library.files))
    const nextLibrary = { activeFileId: file.id, files: [file, ...library.files] }
    replaceLibrary(nextLibrary)
    showWorkspace(file.workspace)
    setStatus('Ready')
    syncWorkspace(file.workspace)
  }, [library.files, replaceLibrary, showWorkspace, syncWorkspace])

  const openDiagram = useCallback(
    (fileId: string) => {
      const file = library.files.find((item) => item.id === fileId)
      if (!file) {
        return
      }

      replaceLibrary({ ...library, activeFileId: file.id })
      showWorkspace(file.workspace)
      setStatus('Ready')
      syncWorkspace(file.workspace)
    },
    [library, replaceLibrary, showWorkspace, syncWorkspace],
  )

  const renameDiagram = useCallback(
    (fileId: string, nextName: string) => {
      const nextLibrary = renameDiagramFile(library, fileId, nextName)
      const nextActiveFile = activeDiagramFile(nextLibrary)
      replaceLibrary(nextLibrary)
      if (nextActiveFile?.id === fileId) {
        showWorkspace(nextActiveFile.workspace)
        syncWorkspace(nextActiveFile.workspace)
      }
    },
    [library, replaceLibrary, showWorkspace, syncWorkspace],
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
      syncWorkspace(nextActiveFile.workspace)
    },
    [library, replaceLibrary, showWorkspace, syncWorkspace],
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
          syncWorkspace(activeWorkspace)
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
  }, [replaceLibrary, showWorkspace, syncWorkspace])

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

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

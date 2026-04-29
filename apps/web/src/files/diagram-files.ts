import {
  createEmptyCanvasDoc,
  type CanvasDoc,
  type Patch,
  type WorkspaceSnapshot,
} from '@voicecanvas/core'

export type DiagramFile = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  workspace: WorkspaceSnapshot
}

export type DiagramLibrary = {
  activeFileId: string
  files: DiagramFile[]
}

export const DIAGRAM_LIBRARY_STORAGE_KEY = 'voicecanvas.diagram-library.v1'
export const DEFAULT_DIAGRAM_NAME = 'Untitled diagram'

export function emptyDiagramLibrary(): DiagramLibrary {
  return { activeFileId: '', files: [] }
}

export function loadDiagramLibrary(storage = browserStorage()): DiagramLibrary | null {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(DIAGRAM_LIBRARY_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<DiagramLibrary>
    const files = Array.isArray(parsed.files) ? parsed.files.filter(isDiagramFile) : []
    if (files.length === 0) {
      return null
    }
    const activeFileId = files.some((file) => file.id === parsed.activeFileId) ? parsed.activeFileId ?? files[0].id : files[0].id
    return { activeFileId, files }
  } catch {
    return null
  }
}

export function saveDiagramLibrary(library: DiagramLibrary, storage = browserStorage()) {
  if (!storage) {
    return
  }

  storage.setItem(DIAGRAM_LIBRARY_STORAGE_KEY, JSON.stringify(library))
}

export function createBlankDiagramFile(name = DEFAULT_DIAGRAM_NAME, now = Date.now()): DiagramFile {
  const id = createDiagramFileId()
  const workspace = workspaceFromCanvas({
    ...createEmptyCanvasDoc(),
    id,
    title: normalizeDiagramName(name),
  })
  return {
    id,
    name: workspace.canvas.title,
    createdAt: now,
    updatedAt: now,
    workspace,
  }
}

export function createDiagramFileFromWorkspace(
  workspace: WorkspaceSnapshot,
  name = displayNameFromWorkspace(workspace),
  now = Date.now(),
): DiagramFile {
  const id = workspace.canvas.id || createDiagramFileId()
  const normalizedName = normalizeDiagramName(name)
  return {
    id,
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
    workspace: withCanvasTitle(workspace, normalizedName),
  }
}

export function nextUntitledDiagramName(files: DiagramFile[]) {
  const names = new Set(files.map((file) => file.name))
  if (!names.has(DEFAULT_DIAGRAM_NAME)) {
    return DEFAULT_DIAGRAM_NAME
  }

  let index = 2
  while (names.has(`${DEFAULT_DIAGRAM_NAME} ${index}`)) {
    index += 1
  }
  return `${DEFAULT_DIAGRAM_NAME} ${index}`
}

export function workspaceFromResponse(workspace: WorkspaceSnapshot): WorkspaceSnapshot {
  return cloneWorkspace(workspace)
}

export function updateActiveWorkspace(library: DiagramLibrary, workspace: WorkspaceSnapshot, now = Date.now()): DiagramLibrary {
  if (!library.activeFileId) {
    const file = createDiagramFileFromWorkspace(workspace, displayNameFromWorkspace(workspace), now)
    return { activeFileId: file.id, files: [file] }
  }

  return {
    ...library,
    files: library.files.map((file) =>
      file.id === library.activeFileId
        ? {
            ...file,
            name: displayNameFromWorkspace(workspace, file.name),
            updatedAt: now,
            workspace: cloneWorkspace(workspace),
          }
        : file,
    ),
  }
}

export function renameDiagramFile(library: DiagramLibrary, fileId: string, nextName: string, now = Date.now()): DiagramLibrary {
  const normalizedName = normalizeDiagramName(nextName)
  return {
    ...library,
    files: library.files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            name: normalizedName,
            updatedAt: now,
            workspace: withCanvasTitle(file.workspace, normalizedName),
          }
        : file,
    ),
  }
}

export function shouldPreferApiWorkspace(apiWorkspace: WorkspaceSnapshot, storedWorkspace: WorkspaceSnapshot) {
  if (apiWorkspace.canvas.id !== storedWorkspace.canvas.id) {
    return false
  }
  if (apiWorkspace.canvas.version > storedWorkspace.canvas.version) {
    return true
  }
  if (apiWorkspace.history.length > storedWorkspace.history.length) {
    return true
  }
  return Boolean(apiWorkspace.pendingPatch && !storedWorkspace.pendingPatch)
}

function displayNameFromWorkspace(workspace: WorkspaceSnapshot, fallback = DEFAULT_DIAGRAM_NAME) {
  const title = workspace.canvas.title.trim()
  return title && title !== 'Untitled flow' ? title : fallback
}

function normalizeDiagramName(name: string) {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_DIAGRAM_NAME
}

function workspaceFromCanvas(canvas: CanvasDoc): WorkspaceSnapshot {
  return { canvas, history: [], pendingPatch: null }
}

function withCanvasTitle(workspace: WorkspaceSnapshot, title: string): WorkspaceSnapshot {
  return {
    canvas: { ...workspace.canvas, title },
    history: clonePatches(workspace.history),
    pendingPatch: workspace.pendingPatch ? clonePatch(workspace.pendingPatch) : null,
  }
}

function cloneWorkspace(workspace: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    canvas: cloneCanvas(workspace.canvas),
    history: clonePatches(workspace.history),
    pendingPatch: workspace.pendingPatch ? clonePatch(workspace.pendingPatch) : null,
  }
}

function cloneCanvas(canvas: CanvasDoc): CanvasDoc {
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => ({ ...node, position: { ...node.position } })),
    edges: canvas.edges.map((edge) => ({ ...edge })),
    viewport: { ...canvas.viewport },
    appliedPatchIds: [...canvas.appliedPatchIds],
  }
}

function clonePatches(patches: Patch[]) {
  return patches.map(clonePatch)
}

function clonePatch(patch: Patch): Patch {
  return JSON.parse(JSON.stringify(patch)) as Patch
}

function createDiagramFileId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `diagram_${crypto.randomUUID()}`
  }
  return `diagram_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function browserStorage() {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

function isDiagramFile(value: unknown): value is DiagramFile {
  const file = value as DiagramFile
  return (
    typeof file?.id === 'string' &&
    typeof file.name === 'string' &&
    typeof file.createdAt === 'number' &&
    typeof file.updatedAt === 'number' &&
    Boolean(file.workspace?.canvas) &&
    Array.isArray(file.workspace.history)
  )
}

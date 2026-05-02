// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyCanvasDoc, type WorkspaceSnapshot } from '@voicecanvas/core'
import {
  createBlankDiagramFile,
  createDiagramFileFromWorkspace,
  loadDiagramLibrary,
  nextUntitledDiagramName,
  renameDiagramFile,
  saveDiagramLibrary,
  shouldPreferApiWorkspace,
} from './diagram-files'

describe('diagram file storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads a browser diagram library', () => {
    const file = createBlankDiagramFile('Project map', 100)

    saveDiagramLibrary({ activeFileId: file.id, files: [file] })

    expect(loadDiagramLibrary()).toEqual({ activeFileId: file.id, files: [file] })
  })

  it('keeps the canvas title aligned when renaming a file', () => {
    const file = createBlankDiagramFile('Draft', 100)
    const library = renameDiagramFile({ activeFileId: file.id, files: [file] }, file.id, 'Launch map', 200)

    expect(library.files[0].name).toBe('Launch map')
    expect(library.files[0].updatedAt).toBe(200)
    expect(library.files[0].workspace.canvas.title).toBe('Launch map')
  })

  it('creates readable default names for new diagrams', () => {
    const first = createBlankDiagramFile('Untitled diagram', 100)
    const second = createBlankDiagramFile('Untitled diagram 2', 200)

    expect(nextUntitledDiagramName([first, second])).toBe('Untitled diagram 3')
  })

  it('can create the first browser file from an API workspace', () => {
    const workspace: WorkspaceSnapshot = {
      canvas: { ...createEmptyCanvasDoc(), title: 'Untitled flow' },
      history: [],
      pendingPatch: null,
    }

    const file = createDiagramFileFromWorkspace(workspace, undefined, 100)

    expect(file.name).toBe('Untitled diagram')
    expect(file.workspace.canvas.title).toBe('Untitled diagram')
  })

  it('prefers a newer API workspace for the same active file', () => {
    const stored: WorkspaceSnapshot = {
      canvas: { ...createEmptyCanvasDoc(), id: 'diagram_1', version: 1 },
      history: [],
      pendingPatch: null,
    }
    const api: WorkspaceSnapshot = {
      canvas: { ...stored.canvas, version: 2 },
      history: [],
      pendingPatch: null,
    }

    expect(shouldPreferApiWorkspace(api, stored)).toBe(true)
  })
})

import { useState, type FocusEvent, type FormEvent } from 'react'
import { Check, ChevronDown, FileText, Plus, Trash2 } from 'lucide-react'
import type { DiagramFile } from '../files/diagram-files'

type FileLibraryMenuProps = {
  activeFile: DiagramFile | null
  files: DiagramFile[]
  onCreate: () => void
  onOpen: (fileId: string) => void
  onRename: (fileId: string, name: string) => void
  onDelete: (fileId: string) => void
}

export function FileLibraryMenu({ activeFile, files, onCreate, onOpen, onRename, onDelete }: FileLibraryMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const activeName = activeFile?.name ?? 'Untitled diagram'

  const commitRename = (nextName: string, input?: HTMLInputElement) => {
    if (!activeFile) {
      return
    }

    const trimmedName = nextName.trim()
    if (trimmedName && trimmedName !== activeFile.name) {
      onRename(activeFile.id, trimmedName)
      return
    }
    if (input) {
      input.value = activeFile.name
    }
  }

  const handleRenameSubmit = (event: FormEvent) => {
    event.preventDefault()
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[name="diagramName"]')
    commitRename(input?.value ?? '', input ?? undefined)
  }

  const handleRenameBlur = (event: FocusEvent<HTMLInputElement>) => {
    commitRename(event.currentTarget.value, event.currentTarget)
  }

  const handleDelete = (file: DiagramFile) => {
    if (window.confirm(`Delete "${file.name}" from this browser?`)) {
      onDelete(file.id)
    }
  }

  return (
    <div className="file-library">
      <button
        type="button"
        className="file-menu-trigger"
        aria-label={`Open diagram files. Current diagram: ${activeName}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <FileText size={16} />
        <span>{activeName}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className="file-menu-panel" aria-label="Diagram files">
          <div className="file-menu-header">
            <form className="file-rename-form" onSubmit={handleRenameSubmit}>
              <input
                key={activeFile?.id ?? 'empty-file-name'}
                name="diagramName"
                aria-label="Diagram name"
                defaultValue={activeName}
                onBlur={handleRenameBlur}
              />
              <button type="submit" aria-label="Apply diagram name">
                <Check size={14} />
              </button>
            </form>
            <button type="button" className="file-new-button" onClick={onCreate} aria-label="New diagram">
              <Plus size={15} />
              <span>New</span>
            </button>
          </div>

          <div className="file-list" role="list" aria-label="Saved diagrams">
            {files.map((file) => (
              <div key={file.id} className={file.id === activeFile?.id ? 'file-row is-active' : 'file-row'} role="listitem">
                <button type="button" className="file-open-button" onClick={() => onOpen(file.id)} aria-label={`Open ${file.name}`}>
                  <span>{file.name}</span>
                  <small>{formatUpdatedAt(file.updatedAt)}</small>
                </button>
                <button type="button" className="file-delete-button" onClick={() => handleDelete(file)} aria-label={`Delete ${file.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatUpdatedAt(updatedAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(updatedAt))
}

import { forwardRef, useCallback, useEffect, useState, type MouseEvent } from 'react'
import mermaid from 'mermaid'

type MermaidDiagramProps = {
  source: string
  version: number
  nodeIds?: string[]
  onSelectNode?: (nodeId: string | null) => void
}

export const MermaidDiagram = forwardRef<HTMLDivElement, MermaidDiagramProps>(function MermaidDiagram(
  { source, version, nodeIds = [], onSelectNode },
  ref,
) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `voicecanvas-${version}-${Date.now()}`

    mermaid
      .render(id, source)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg)
          setError(null)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Mermaid render failed')
        }
      })

    return () => {
      cancelled = true
    }
  }, [source, version])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (onSelectNode) {
        onSelectNode(findMermaidNodeId(event.target, nodeIds))
      }
    },
    [nodeIds, onSelectNode],
  )

  if (error) {
    return <div className="mermaid-error">{error}</div>
  }

  return (
    <div
      ref={ref}
      className="mermaid-canvas"
      aria-label="Rendered Mermaid diagram"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
})

function findMermaidNodeId(target: EventTarget | null, nodeIds: string[]) {
  if (!(target instanceof Element)) {
    return null
  }

  const safeNodeIds = nodeIds
    .map((id) => ({ id, safeId: safeMermaidId(id) }))
    .sort((a, b) => b.safeId.length - a.safeId.length)
  let current: Element | null = target

  while (current) {
    const elementId = current.getAttribute('id') ?? ''
    const elementClass = current.getAttribute('class') ?? ''
    const elementText = `${elementId} ${elementClass}`
    const match = safeNodeIds.find(({ safeId }) => containsMermaidNodeId(elementText, safeId))

    if (match) {
      return match.id
    }

    if (current.classList.contains('mermaid-canvas')) {
      return null
    }

    current = current.parentElement
  }

  return null
}

function containsMermaidNodeId(value: string, safeId: string) {
  return value === safeId || value.includes(safeId)
}

function safeMermaidId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

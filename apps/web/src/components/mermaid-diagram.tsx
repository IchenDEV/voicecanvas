import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

type MermaidDiagramProps = {
  source: string
  version: number
}

export function MermaidDiagram({ source, version }: MermaidDiagramProps) {
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

  if (error) {
    return <div className="mermaid-error">{error}</div>
  }

  return <div className="mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
}

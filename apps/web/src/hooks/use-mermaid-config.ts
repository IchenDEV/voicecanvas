import { useEffect } from 'react'
import mermaid from 'mermaid'

export function useMermaidConfig() {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#121212',
        primaryBorderColor: '#cfcfcf',
        lineColor: '#4d4d4d',
        tertiaryColor: '#f7f4ef',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      },
    })
  }, [])
}

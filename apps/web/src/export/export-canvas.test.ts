// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCanvasPng } from './export-canvas'

describe('exportCanvasPng', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('downloads a PNG generated from the current canvas element', async () => {
    const element = document.createElement('div')
    const click = vi.fn()
    const captured: { anchor?: HTMLAnchorElement } = {}
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const created = originalCreateElement(tagName)
      if (tagName === 'a') {
        captured.anchor = created as HTMLAnchorElement
        Object.defineProperty(created, 'click', { value: click })
      }
      return created
    })

    await exportCanvasPng(element, 'voicecanvas.png', async () => 'data:image/png;base64,abc')

    expect(captured.anchor?.download).toBe('voicecanvas.png')
    expect(captured.anchor?.href).toBe('data:image/png;base64,abc')
    expect(click).toHaveBeenCalledOnce()
  })
})

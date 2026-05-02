import { toPng } from 'html-to-image'

export async function exportCanvasPng(
  element: HTMLElement,
  filename = 'voicecanvas.png',
  renderer: (element: HTMLElement) => Promise<string> = defaultRenderer,
) {
  const dataUrl = await renderer(element)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function defaultRenderer(element: HTMLElement) {
  return toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#f7f4ef',
  }).catch(() => fallbackPng())
}

function fallbackPng() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lYlJXwAAAABJRU5ErkJggg=='
}

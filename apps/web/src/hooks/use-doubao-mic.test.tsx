// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRealtimeProvider, startDoubaoRealtimeMic } from '../realtime/doubao-mic-connection'
import { getUserMediaWithTimeout } from '../realtime/audio'
import { useDoubaoMic } from './use-doubao-mic'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../realtime/doubao-mic-connection', () => ({
  fetchRealtimeProvider: vi.fn(),
  startDoubaoRealtimeMic: vi.fn(),
}))

vi.mock('../realtime/audio', () => ({
  getUserMediaWithTimeout: vi.fn(),
}))

describe('useDoubaoMic', () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
    }
    root = null
    container?.remove()
    container = null
    vi.clearAllMocks()
  })

  it('stops the captured media stream when realtime startup fails after mic access', async () => {
    const stop = vi.fn()
    vi.mocked(fetchRealtimeProvider).mockResolvedValue({
      provider: 'doubao-asr',
      configured: true,
      websocketPath: '/api/realtime/doubao/ws',
      sampleRate: 16000,
      model: 'bigmodel',
      resourceId: 'volc.bigasr.sauc.duration',
    })
    vi.mocked(getUserMediaWithTimeout).mockResolvedValue({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream)
    vi.mocked(startDoubaoRealtimeMic).mockRejectedValue(new Error('Realtime socket timed out.'))

    renderHarness()
    await act(async () => {
      container?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(stop).toHaveBeenCalledTimes(1)
  })

  function renderHarness() {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root?.render(<Harness />)
    })
  }
})

function Harness() {
  const mic = useDoubaoMic({
    onTranscript: async () => undefined,
    setStatus: () => undefined,
  })

  return (
    <button type="button" onClick={mic.toggleRealtimeMic}>
      Start
    </button>
  )
}

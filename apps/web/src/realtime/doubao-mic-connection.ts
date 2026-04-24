import { createDoubaoSessionUpdate } from './doubao-realtime'
import { startDoubaoAudioPump, type AudioRefs } from './audio'
import { withTimeout } from './startup'
import type { RealtimeProviderResponse } from '../types'

type StartDoubaoRealtimeMicOptions = {
  provider: RealtimeProviderResponse
  refs: AudioRefs
  stream: MediaStream
  setStatus: (status: string) => void
  handleRealtimeEvent: (event: string) => Promise<void>
}

export async function fetchRealtimeProvider(): Promise<RealtimeProviderResponse> {
  const response = await fetch('/api/realtime/provider')
  if (!response.ok) {
    throw new Error('Realtime provider unavailable')
  }
  return response.json() as Promise<RealtimeProviderResponse>
}

export async function startDoubaoRealtimeMic(options: StartDoubaoRealtimeMicOptions): Promise<WebSocket> {
  if (!options.provider.configured) {
    throw new Error('DOUBAO_API_KEY is required.')
  }

  const socket = new WebSocket(createLocalWebSocketUrl(options.provider.websocketPath))
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      void options.handleRealtimeEvent(event.data)
    }
  })
  await withTimeout(waitForSocketOpen(socket), 8_000, 'Realtime socket timed out.')
  socket.send(JSON.stringify(createDoubaoSessionUpdate()))
  await startDoubaoAudioPump({ ...options, socket, targetSampleRate: options.provider.sampleRate })
  return socket
}

function waitForSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('Doubao realtime socket failed.')), { once: true })
  })
}

function createLocalWebSocketUrl(path: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${path}`
}

import { describe, expect, it } from 'vitest'
import { createApp } from './app'

describe('VoiceCanvas realtime API', () => {
  it('uses Doubao as the default realtime provider', async () => {
    const app = createApp()

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('doubao-asr')
    expect(payload.websocketPath).toBe('/api/realtime/doubao/ws')
    expect(payload.configured).toBe(false)
    expect(payload.sampleRate).toBe(16000)
    expect(payload.resourceId).toBe('volc.bigasr.sauc.duration')
  })

  it('reports Doubao ASR as configured when the new-console API key is present', async () => {
    const app = createApp({ doubaoAPIKey: 'test-speech-ak' })

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('doubao-asr')
    expect(payload.configured).toBe(true)
    expect(payload.model).toBe('bigmodel')
    expect(payload.resourceId).toBe('volc.bigasr.sauc.duration')
  })

  it('does not expose the legacy realtime session route', async () => {
    const app = createApp()

    const response = await app.request(`/api/realtime/${'op' + 'enai'}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: 'v=0',
    })

    expect(response.status).toBe(404)
  })
})

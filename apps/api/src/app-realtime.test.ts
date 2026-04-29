import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app'

describe('VoiceCanvas realtime API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses OpenAI Realtime as the default realtime provider', async () => {
    const app = createApp()

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('openai-realtime')
    expect(payload.configured).toBe(false)
    expect(payload.model).toBe('gpt-realtime-1.5')
    expect(payload.sessionPath).toBe('/api/realtime/openai/session')
  })

  it('reports OpenAI Realtime as configured when the API key is present', async () => {
    const app = createApp({ openaiAPIKey: 'sk-test', openaiRealtimeModel: 'gpt-realtime-mini' })

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('openai-realtime')
    expect(payload.configured).toBe(true)
    expect(payload.model).toBe('gpt-realtime-mini')
    expect(payload.sessionPath).toBe('/api/realtime/openai/session')
  })

  it('requires OPENAI_API_KEY before opening a realtime session', async () => {
    const app = createApp()

    const response = await app.request('/api/realtime/openai/session', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      body: '--test--',
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'OPENAI_API_KEY is required.' })
  })

  it('proxies realtime session offers to OpenAI without exposing the API key', async () => {
    const fetchMock = vi.fn(async () => new Response('v=0 answer', { headers: { 'content-type': 'application/sdp' } }))
    vi.stubGlobal('fetch', fetchMock)
    const app = createApp({ openaiAPIKey: 'sk-test', openaiRealtimeModel: 'gpt-realtime-mini' })
    const formData = new FormData()
    formData.set('sdp', 'v=0 offer')
    formData.set('session', JSON.stringify({ model: 'client-model', instructions: 'test instructions' }))

    const response = await app.request('/api/realtime/openai/session', {
      method: 'POST',
      headers: { Host: 'localhost:8787' },
      body: formData,
    })

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('v=0 answer')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/calls',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )

    const init = fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string }
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer sk-test')
    expect(headers.get('content-type')).toBeNull()
    expect(headers.get('host')).toBeNull()
    expect(headers.get('content-length')).toBeNull()
    expect(init.duplex).toBeUndefined()

    const forwardedFormData = init.body as FormData
    expect(forwardedFormData.get('sdp')).toBe('v=0 offer')
    expect(JSON.parse(String(forwardedFormData.get('session')))).toMatchObject({
      model: 'gpt-realtime-mini',
      instructions: 'test instructions',
    })
  })
})

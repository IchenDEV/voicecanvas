import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app'

const geminiMocks = vi.hoisted(() => {
  const createAuthToken = vi.fn(async () => ({ name: 'gemini-token-test' }))
  return {
    createAuthToken,
    GoogleGenAI: vi.fn(function GoogleGenAIMock() {
      return {
        authTokens: {
          create: createAuthToken,
        },
      }
    }),
  }
})

vi.mock('@google/genai', () => ({
  GoogleGenAI: geminiMocks.GoogleGenAI,
  Modality: { TEXT: 'TEXT' },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
}))

describe('VoiceCanvas realtime API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    geminiMocks.createAuthToken.mockResolvedValue({ name: 'gemini-token-test' })
  })

  it('uses OpenAI Realtime as the default realtime provider', async () => {
    const app = createApp()

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('openai-realtime')
    expect(payload.configured).toBe(false)
    expect(payload.model).toBe('gpt-realtime-2')
    expect(payload.sessionPath).toBe('/api/realtime/openai/session')
    expect(payload.defaultProvider).toBe('openai-realtime')
    expect(payload.providers).toEqual([
      {
        provider: 'openai-realtime',
        configured: false,
        model: 'gpt-realtime-2',
        sessionPath: '/api/realtime/openai/session',
      },
      {
        provider: 'gemini-live',
        configured: false,
        model: 'gemini-3.1-flash-live-preview',
        tokenPath: '/api/realtime/gemini/token',
      },
    ])
  })

  it('reports OpenAI Realtime as configured when the API key is present', async () => {
    const app = createApp({
      openaiAPIKey: 'sk-test',
      openaiRealtimeModel: 'gpt-realtime-mini',
      geminiAPIKey: 'gemini-test',
      geminiLiveModel: 'gemini-live-test',
    })

    const response = await app.request('/api/realtime/provider')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.provider).toBe('openai-realtime')
    expect(payload.configured).toBe(true)
    expect(payload.model).toBe('gpt-realtime-mini')
    expect(payload.sessionPath).toBe('/api/realtime/openai/session')
    expect(payload.providers[1]).toEqual({
      provider: 'gemini-live',
      configured: true,
      model: 'gemini-live-test',
      tokenPath: '/api/realtime/gemini/token',
    })
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

  it('requires GEMINI_API_KEY before issuing a Gemini Live token', async () => {
    const app = createApp()

    const response = await app.request('/api/realtime/gemini/token', { method: 'POST' })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'GEMINI_API_KEY is required.' })
  })

  it('creates a scoped Gemini Live token for the browser session', async () => {
    const app = createApp({ geminiAPIKey: 'gemini-test', geminiLiveModel: 'gemini-live-test' })

    const response = await app.request('/api/realtime/gemini/token', { method: 'POST' })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      provider: 'gemini-live',
      model: 'gemini-live-test',
      token: 'gemini-token-test',
    })
    expect(geminiMocks.GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'gemini-test',
      httpOptions: { apiVersion: 'v1alpha' },
    })
    expect(geminiMocks.createAuthToken).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          uses: 1,
          httpOptions: { apiVersion: 'v1alpha' },
          liveConnectConstraints: expect.objectContaining({
            model: 'gemini-live-test',
            config: expect.objectContaining({
              responseModalities: ['TEXT'],
              inputAudioTranscription: {},
              tools: expect.any(Array),
            }),
          }),
        }),
      }),
    )
  })
})

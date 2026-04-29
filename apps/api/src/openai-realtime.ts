export const OPENAI_REALTIME_PROVIDER = 'openai-realtime'
export const OPENAI_REALTIME_SESSION_PATH = '/api/realtime/openai/session'
export const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime-1.5'

const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

export type OpenAIRealtimeConfig = {
  apiKey: string
  model: string
}

export type OpenAIRealtimeOptions = {
  apiKey?: string
  model?: string
}

export function resolveOpenAIRealtimeConfig(options: OpenAIRealtimeOptions = {}): OpenAIRealtimeConfig | null {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    model: resolveOpenAIRealtimeModel(options.model),
  }
}

export function resolveOpenAIRealtimeModel(model?: string) {
  return model ?? process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_OPENAI_REALTIME_MODEL
}

export function openAIRealtimeProviderPayload(options: OpenAIRealtimeOptions = {}) {
  const config = resolveOpenAIRealtimeConfig(options)

  return {
    provider: OPENAI_REALTIME_PROVIDER,
    configured: Boolean(config),
    model: config?.model ?? resolveOpenAIRealtimeModel(options.model),
    sessionPath: OPENAI_REALTIME_SESSION_PATH,
  }
}

export async function proxyOpenAIRealtimeSession(request: Request, options: OpenAIRealtimeOptions = {}) {
  const config = resolveOpenAIRealtimeConfig(options)
  if (!config) {
    return jsonResponse({ error: 'OPENAI_API_KEY is required.' }, 401)
  }

  const body = await realtimeSessionRequestBody(request, config.model)
  const headers = proxyHeaders(request.headers, config.apiKey, body instanceof FormData)
  const requestInit: RequestInit & { duplex?: 'half' } = {
    method: 'POST',
    headers,
    body,
  }
  if (!(body instanceof FormData)) {
    requestInit.duplex = 'half'
  }

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, requestInit)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response.headers),
  })
}

async function realtimeSessionRequestBody(request: Request, model: string): Promise<BodyInit | null> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return request.body
  }

  const formData = await request.formData()
  const session = sessionWithModel(formData.get('session'), model)
  formData.set('session', JSON.stringify(session))
  return formData
}

function sessionWithModel(value: FormDataEntryValue | null, model: string) {
  if (typeof value !== 'string') {
    return { model }
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? { ...parsed, model } : { model }
  } catch {
    return { model }
  }
}

function proxyHeaders(incomingHeaders: Headers, apiKey: string, generatedFormData: boolean) {
  const headers = new Headers(incomingHeaders)
  headers.set('Authorization', `Bearer ${apiKey}`)
  headers.delete('host')
  headers.delete('content-length')
  if (generatedFormData) {
    headers.delete('content-type')
  }
  return headers
}

function responseHeaders(openAIHeaders: Headers) {
  const headers = new Headers()
  const contentType = openAIHeaders.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  return headers
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type DoubaoRealtimeConfig = {
  apiKey: string
  model: string
  resourceId: string
  upstreamUrl: string
}

export type DoubaoRealtimeOptions = {
  apiKey?: string
  model?: string
  resourceId?: string
  upstreamUrl?: string
  env?: NodeJS.ProcessEnv
}

export function resolveDoubaoRealtimeConfig(options: DoubaoRealtimeOptions = {}): DoubaoRealtimeConfig | null {
  const env = options.env ?? process.env
  const apiKey = options.apiKey ?? env.DOUBAO_API_KEY
  const model = options.model ?? env.DOUBAO_ASR_MODEL ?? 'bigmodel'
  const resourceId = options.resourceId ?? env.DOUBAO_ASR_RESOURCE_ID ?? 'volc.bigasr.sauc.duration'
  const upstreamUrl =
    options.upstreamUrl ?? env.DOUBAO_ASR_URL ?? 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'

  if (!apiKey) {
    return null
  }

  return { apiKey, model, resourceId, upstreamUrl }
}

export function toClientCloseCode(code: number): number {
  if (code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006 && code !== 1015) {
    return code
  }

  return 1011
}

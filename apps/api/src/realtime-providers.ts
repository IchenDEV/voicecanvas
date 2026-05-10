import { geminiLiveProviderPayload, type GeminiLiveOptions } from './gemini-live'
import {
  OPENAI_REALTIME_PROVIDER,
  openAIRealtimeProviderPayload,
  type OpenAIRealtimeOptions,
} from './openai-realtime'

type RealtimeProviderOptions = {
  openai: OpenAIRealtimeOptions
  gemini: GeminiLiveOptions
}

export function realtimeProvidersPayload(options: RealtimeProviderOptions) {
  const openai = openAIRealtimeProviderPayload(options.openai)
  const gemini = geminiLiveProviderPayload(options.gemini)

  return {
    ...openai,
    defaultProvider: OPENAI_REALTIME_PROVIDER,
    providers: [openai, gemini],
  }
}

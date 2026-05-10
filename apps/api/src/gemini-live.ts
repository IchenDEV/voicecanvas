import { GoogleGenAI, Modality, Type, type LiveConnectConfig } from '@google/genai'

export const GEMINI_LIVE_PROVIDER = 'gemini-live'
export const GEMINI_LIVE_TOKEN_PATH = '/api/realtime/gemini/token'
export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview'

const GEMINI_APPLY_TOOL_NAME = 'apply_voice_command'
const GEMINI_TOKEN_SESSION_MS = 60 * 1000
const GEMINI_TOKEN_EXPIRE_MS = 30 * 60 * 1000

export type GeminiLiveConfig = {
  apiKey: string
  model: string
}

export type GeminiLiveOptions = {
  apiKey?: string
  model?: string
}

export function resolveGeminiLiveConfig(options: GeminiLiveOptions = {}): GeminiLiveConfig | null {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return null
  }

  return {
    apiKey,
    model: resolveGeminiLiveModel(options.model),
  }
}

export function resolveGeminiLiveModel(model?: string) {
  return model ?? process.env.GEMINI_LIVE_MODEL ?? DEFAULT_GEMINI_LIVE_MODEL
}

export function geminiLiveProviderPayload(options: GeminiLiveOptions = {}) {
  const config = resolveGeminiLiveConfig(options)

  return {
    provider: GEMINI_LIVE_PROVIDER,
    configured: Boolean(config),
    model: config?.model ?? resolveGeminiLiveModel(options.model),
    tokenPath: GEMINI_LIVE_TOKEN_PATH,
  }
}

export async function createGeminiLiveToken(options: GeminiLiveOptions = {}) {
  const config = resolveGeminiLiveConfig(options)
  if (!config) {
    return jsonResponse({ error: 'GEMINI_API_KEY is required.' }, 401)
  }

  try {
    const client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    })
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + GEMINI_TOKEN_EXPIRE_MS).toISOString(),
        newSessionExpireTime: new Date(Date.now() + GEMINI_TOKEN_SESSION_MS).toISOString(),
        liveConnectConstraints: {
          model: config.model,
          config: geminiLiveConnectConfig(),
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    if (!token.name) {
      return jsonResponse({ error: 'Gemini Live token unavailable.' }, 502)
    }

    return jsonResponse(
      {
        provider: GEMINI_LIVE_PROVIDER,
        model: config.model,
        token: token.name,
      },
      200,
    )
  } catch {
    return jsonResponse({ error: 'Gemini Live token unavailable.' }, 502)
  }
}

export function geminiLiveConnectConfig(): LiveConnectConfig {
  return {
    responseModalities: [Modality.TEXT],
    inputAudioTranscription: {},
    systemInstruction: VOICECANVAS_GEMINI_INSTRUCTIONS,
    tools: [
      {
        functionDeclarations: [
          {
            name: GEMINI_APPLY_TOOL_NAME,
            description:
              'Apply the spoken request to the current VoiceCanvas diagram. Use this for add, delete, rename, replace, move, and clarification commands.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                command: {
                  type: Type.STRING,
                  description: 'A concise VoiceCanvas diagram editing command inferred from the user speech.',
                },
              },
              required: ['command'],
            },
          },
        ],
      },
    ],
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const VOICECANVAS_GEMINI_INSTRUCTIONS = `
You are the voice command interpreter for VoiceCanvas, a Mermaid diagram editor.
Always call apply_voice_command exactly once for a user request that can change or clarify the diagram.
Put the inferred diagram command in command. Keep it short and directly actionable.
Preserve visible labels exactly when the user refers to text on the diagram or in the UI.
For delete requests, include the target label, for example: delete "Mermaid rendering".
For rename or replace requests, include both labels, for example: change "Format rendering" to "Mermaid rendering".
If the user says a similar-sounding label, keep the closest visible English phrase.
Do not invent extra diagram content. If the request is unclear, ask for clarification by calling apply_voice_command with a clarification command.
`

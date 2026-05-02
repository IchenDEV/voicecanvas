import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defineVoiceTool,
  useVoiceControl,
  type ToolCallErrorEvent,
  type ToolCallEvent,
  type ToolCallResultEvent,
  type VoiceControlActivity,
  type VoiceControlError,
  type VoiceControlEvent,
  type VoiceControlStatus,
} from 'realtime-voice-component'
import { z } from 'zod'
import { debugRealtimeEvent, debugVoiceToolCall } from '../debug-logger'

const REALTIME_SESSION_ENDPOINT = '/api/realtime/openai/session'
const REALTIME_PROVIDER_ENDPOINT = '/api/realtime/provider'

const voiceCommandSchema = z.object({
  command: z
    .string()
    .trim()
    .min(1)
    .describe('A concise VoiceCanvas diagram editing command inferred from the user speech.'),
})

type VoiceCommandArgs = z.infer<typeof voiceCommandSchema>

type OpenAIRealtimeVoiceOptions = {
  onCommand: (command: string) => Promise<unknown>
  setStatus: (status: string) => void
}

export function useOpenAIRealtimeVoice({ onCommand, setStatus }: OpenAIRealtimeVoiceOptions) {
  const [realtimeModel, setRealtimeModel] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    void fetch(REALTIME_PROVIDER_ENDPOINT)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const model = realtimeModelFromProviderPayload(payload)
        if (!cancelled && model) {
          setRealtimeModel(model)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  const applyVoiceCommand = useMemo(
    () =>
      defineVoiceTool<VoiceCommandArgs>({
        name: 'apply_voice_command',
        description:
          'Apply the spoken request to the current VoiceCanvas diagram. Use this for add, delete, rename, replace, move, and clarification commands.',
        parameters: voiceCommandSchema,
        execute: async ({ command }) => {
          const normalizedCommand = command.trim()
          setStatus(`Heard: ${normalizedCommand}`)
          return onCommand(normalizedCommand)
        },
      }),
    [onCommand, setStatus],
  )

  const handleEvent = useCallback((event: VoiceControlEvent) => {
    debugRealtimeEvent(realtimeDebugEvent(event))
  }, [])

  const handleError = useCallback(
    (error: VoiceControlError) => {
      debugRealtimeEvent({ type: 'voice.error', error: error.message })
      setStatus(realtimeVoiceErrorStatus(error))
    },
    [setStatus],
  )

  const handleToolStart = useCallback(
    (call: ToolCallEvent) => {
      debugVoiceToolCall('started', call)
      setStatus('Planning')
    },
    [setStatus],
  )

  const handleToolSuccess = useCallback(
    (call: ToolCallResultEvent) => {
      debugVoiceToolCall('succeeded', call)
      setStatus('Listening')
    },
    [setStatus],
  )

  const handleToolError = useCallback(
    (call: ToolCallErrorEvent) => {
      debugVoiceToolCall('failed', call)
      setStatus('Voice command failed')
    },
    [setStatus],
  )

  const voice = useVoiceControl({
    auth: { sessionEndpoint: REALTIME_SESSION_ENDPOINT },
    tools: [applyVoiceCommand],
    instructions: VOICECANVAS_REALTIME_INSTRUCTIONS,
    ...(realtimeModel ? { model: realtimeModel } : {}),
    activationMode: 'vad',
    outputMode: 'tool-only',
    toolChoice: 'required',
    audio: {
      input: {
        transcription: { model: 'gpt-4o-mini-transcribe' },
        noiseReduction: { type: 'near_field' },
        turnDetection: {
          type: 'server_vad',
          createResponse: true,
          interruptResponse: true,
          threshold: 0.5,
          prefixPaddingMs: 300,
          silenceDurationMs: 500,
        },
      },
    },
    onEvent: handleEvent,
    onError: handleError,
    onToolStart: handleToolStart,
    onToolSuccess: handleToolSuccess,
    onToolError: handleToolError,
  })

  const isRealtimeActive = voice.connected || voice.status === 'connecting'
  const toggleRealtimeMic = useCallback(() => {
    if (voice.connected || voice.status === 'connecting') {
      voice.disconnect()
      setStatus('Ready')
      return
    }

    setStatus('Connecting')
    void voice.connect().catch((error: unknown) => {
      const status = realtimeVoiceErrorStatus(error)
      debugRealtimeEvent({ type: 'voice.connect.failed', error: errorMessage(error) })
      setStatus(status)
    })
  }, [setStatus, voice])

  return {
    isRealtimeActive,
    status: voiceStatusLabel(voice.status, voice.activity, voice.connected),
    toggleRealtimeMic,
  }
}

export function realtimeModelFromProviderPayload(payload: unknown) {
  if (!isRecord(payload) || payload.provider !== 'openai-realtime') {
    return null
  }

  return stringValue(payload.model) || null
}

export function voiceStatusLabel(status: VoiceControlStatus, activity: VoiceControlActivity, connected: boolean) {
  if (status === 'connecting' || activity === 'connecting') {
    return 'Connecting'
  }
  if (status === 'processing' || activity === 'processing') {
    return 'Planning'
  }
  if (activity === 'executing') {
    return 'Applying'
  }
  if (status === 'listening' || activity === 'listening') {
    return 'Listening'
  }
  if (status === 'error' || activity === 'error') {
    return 'Voice error'
  }
  if (connected) {
    return 'Listening'
  }
  return null
}

export function realtimeVoiceErrorStatus(error: unknown) {
  const message = errorMessage(error)
  const name = errorName(error)

  if (message.includes('OPENAI_API_KEY')) {
    return 'OpenAI key needed'
  }
  if (name === 'NotAllowedError' || message.includes('Permission denied')) {
    return 'Mic permission denied'
  }
  if (name === 'NotFoundError' || message.includes('Requested device not found')) {
    return 'No microphone found'
  }
  if (message.includes('insecure contexts') || message.includes('HTTPS or localhost')) {
    return 'Use HTTPS or localhost'
  }
  if (message.includes('Failed to establish Realtime WebRTC session') || message.includes('network')) {
    return 'OpenAI Realtime unavailable'
  }
  return 'Mic unavailable'
}

const VOICECANVAS_REALTIME_INSTRUCTIONS = `
You are the voice command interpreter for VoiceCanvas, a Mermaid diagram editor.
Always call apply_voice_command exactly once for a user request that can change or clarify the diagram.
Put the inferred diagram command in command. Keep it short and directly actionable.
Preserve visible labels exactly when the user refers to text on the diagram or in the UI.
For delete requests, include the target label, for example: delete "Mermaid rendering".
For rename or replace requests, include both labels, for example: change "Format rendering" to "Mermaid rendering".
If the user says a similar-sounding label, keep the closest visible English phrase.
Do not invent extra diagram content. If the request is unclear, ask for clarification by calling apply_voice_command with a clarification command.
`

function realtimeDebugEvent(event: VoiceControlEvent) {
  const record: Record<string, unknown> = isRecord(event) ? event : {}
  return {
    type: stringValue(record.type),
    transcript: transcriptFromRealtimeEvent(record),
    command: commandFromRealtimeEvent(record),
    error: realtimeEventError(record),
  }
}

function transcriptFromRealtimeEvent(event: Record<string, unknown>) {
  const transcript = stringValue(event.transcript)
  if (transcript) {
    return transcript
  }

  if (String(event.type ?? '').includes('transcript')) {
    return stringValue(event.delta)
  }

  return ''
}

function commandFromRealtimeEvent(event: Record<string, unknown>) {
  const args = event.arguments
  if (typeof args !== 'string') {
    return ''
  }

  try {
    const parsed = JSON.parse(args) as unknown
    return isRecord(parsed) ? stringValue(parsed.command) : ''
  } catch {
    return ''
  }
}

function realtimeEventError(event: Record<string, unknown>) {
  const error = event.error
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  if (isRecord(error)) {
    return stringValue(error.message) || stringValue(error.type)
  }
  return ''
}

function errorMessage(error: unknown) {
  if (isRecord(error)) {
    return stringValue(error.message)
  }
  return error instanceof Error ? error.message : String(error ?? '')
}

function errorName(error: unknown) {
  if (isRecord(error)) {
    return stringValue(error.name)
  }
  return error instanceof Error ? error.name : ''
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

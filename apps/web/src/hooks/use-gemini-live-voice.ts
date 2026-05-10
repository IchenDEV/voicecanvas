import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type {
  FunctionCall,
  FunctionResponse,
  LiveConnectConfig,
  LiveServerMessage,
  Modality,
  Session,
  Type,
} from '@google/genai'
import { debugRealtimeEvent, debugVoiceToolCall } from '../debug-logger'

const GEMINI_LIVE_TOKEN_ENDPOINT = '/api/realtime/gemini/token'
const GEMINI_APPLY_TOOL_NAME = 'apply_voice_command'
const GEMINI_TEXT_MODALITY = 'TEXT' as Modality
const GEMINI_OBJECT_TYPE = 'OBJECT' as Type
const GEMINI_STRING_TYPE = 'STRING' as Type

type GeminiVoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'error'

type GeminiLiveVoiceOptions = {
  onCommand: (command: string) => Promise<unknown>
  setStatus: (status: string) => void
}

type GeminiAudioResources = {
  stream: MediaStream
  audioContext: AudioContext
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
}

type GeminiTokenPayload = {
  provider: 'gemini-live'
  model: string
  token: string
}

export function useGeminiLiveVoice({ onCommand, setStatus }: GeminiLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<GeminiVoiceState>('idle')
  const sessionRef = useRef<Session | null>(null)
  const audioResourcesRef = useRef<GeminiAudioResources | null>(null)

  const handleGeminiMessage = useCallback(
    async (message: LiveServerMessage) => {
      const transcript = message.serverContent?.inputTranscription?.text ?? ''
      if (transcript) {
        debugRealtimeEvent({ type: 'voice.gemini.transcript', transcript })
      }

      const functionCalls = message.toolCall?.functionCalls ?? []
      if (functionCalls.length === 0) {
        return
      }

      setVoiceState('processing')
      const functionResponses = await executeGeminiFunctionCalls(functionCalls, onCommand, setStatus)
      sessionRef.current?.sendToolResponse({ functionResponses })
      setVoiceState('listening')
    },
    [onCommand, setStatus],
  )

  const stopRealtimeMic = useCallback(() => {
    stopGeminiSession(sessionRef, audioResourcesRef)
    setVoiceState('idle')
    setStatus('Ready')
  }, [setStatus])

  const connectGeminiLive = useCallback(async () => {
    setVoiceState('connecting')
    setStatus('Connecting')

    const tokenPayload = await createGeminiLiveToken()
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({
      apiKey: tokenPayload.token,
      httpOptions: { apiVersion: 'v1alpha' },
    })
    const session = await ai.live.connect({
      model: tokenPayload.model,
      config: geminiLiveConnectConfig(),
      callbacks: {
        onopen: () => {
          debugRealtimeEvent({ type: 'voice.gemini.connected' })
        },
        onmessage: (message) => {
          void handleGeminiMessage(message)
        },
        onerror: (event) => {
          debugRealtimeEvent({ type: 'voice.gemini.error', error: event.message })
          setVoiceState('error')
          setStatus(geminiLiveErrorStatus(event))
        },
        onclose: (event) => {
          debugRealtimeEvent({ type: 'voice.gemini.closed', error: event.reason })
          stopGeminiAudioResources(audioResourcesRef)
          sessionRef.current = null
          setVoiceState('idle')
        },
      },
    })

    sessionRef.current = session
    audioResourcesRef.current = await startGeminiAudioInput(session)
    setVoiceState('listening')
    setStatus('Listening')
  }, [handleGeminiMessage, setStatus])

  const toggleRealtimeMic = useCallback(() => {
    if (voiceState === 'connecting' || voiceState === 'listening' || voiceState === 'processing') {
      stopRealtimeMic()
      return
    }

    void connectGeminiLive().catch((error: unknown) => {
      stopGeminiSession(sessionRef, audioResourcesRef)
      debugRealtimeEvent({ type: 'voice.gemini.connect.failed', error: errorMessage(error) })
      setVoiceState('error')
      setStatus(geminiLiveErrorStatus(error))
    })
  }, [connectGeminiLive, setStatus, stopRealtimeMic, voiceState])

  useEffect(() => {
    return () => {
      stopGeminiSession(sessionRef, audioResourcesRef)
    }
  }, [])

  return {
    isRealtimeActive: voiceState === 'connecting' || voiceState === 'listening' || voiceState === 'processing',
    status: geminiVoiceStatusLabel(voiceState),
    toggleRealtimeMic,
    stopRealtimeMic,
  }
}

export function geminiVoiceStatusLabel(state: GeminiVoiceState) {
  if (state === 'connecting') {
    return 'Connecting'
  }
  if (state === 'processing') {
    return 'Planning'
  }
  if (state === 'listening') {
    return 'Listening'
  }
  if (state === 'error') {
    return 'Voice error'
  }
  return null
}

export function geminiCommandFromFunctionCall(call: Pick<FunctionCall, 'name' | 'args'>) {
  if (call.name !== GEMINI_APPLY_TOOL_NAME) {
    return ''
  }

  const command = call.args?.command
  return typeof command === 'string' ? command.trim() : ''
}

export function geminiLiveErrorStatus(error: unknown) {
  const message = errorMessage(error)
  const name = errorName(error)

  if (message.includes('GEMINI_API_KEY')) {
    return 'Gemini key needed'
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
  if (message.includes('Gemini Live token') || message.includes('network')) {
    return 'Gemini Live unavailable'
  }
  return 'Mic unavailable'
}

export function float32ToPcm16Base64(input: Float32Array, inputSampleRate = 16000, outputSampleRate = 16000) {
  const samples = downsampleFloat32(input, inputSampleRate, outputSampleRate)
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return uint8ArrayToBase64(new Uint8Array(buffer))
}

function downsampleFloat32(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate <= outputSampleRate) {
    return input
  }

  const ratio = inputSampleRate / outputSampleRate
  const output = new Float32Array(Math.floor(input.length / ratio))
  for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio)
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), input.length)
    let sum = 0
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex] ?? 0
    }
    output[outputIndex] = sum / Math.max(1, end - start)
  }
  return output
}

async function executeGeminiFunctionCalls(
  functionCalls: FunctionCall[],
  onCommand: (command: string) => Promise<unknown>,
  setStatus: (status: string) => void,
): Promise<FunctionResponse[]> {
  const functionResponses: FunctionResponse[] = []

  for (const call of functionCalls) {
    const command = geminiCommandFromFunctionCall(call)
    debugRealtimeEvent({ type: 'voice.gemini.function_call', command })
    debugVoiceToolCall('started', { callId: call.id, name: call.name, args: call.args })

    if (!command) {
      const error = 'Missing VoiceCanvas command.'
      debugVoiceToolCall('failed', { callId: call.id, name: call.name, args: call.args, error })
      functionResponses.push(geminiFunctionResponse(call, { error }))
      continue
    }

    setStatus(`Heard: ${command}`)
    try {
      const output = await onCommand(command)
      debugVoiceToolCall('succeeded', { callId: call.id, name: call.name, args: call.args, output })
      functionResponses.push(geminiFunctionResponse(call, { result: 'ok' }))
    } catch (error) {
      const message = errorMessage(error) || 'Voice command failed.'
      debugVoiceToolCall('failed', { callId: call.id, name: call.name, args: call.args, error: message })
      functionResponses.push(geminiFunctionResponse(call, { error: message }))
    }
  }

  return functionResponses
}

function geminiFunctionResponse(call: FunctionCall, response: Record<string, unknown>): FunctionResponse {
  return {
    id: call.id,
    name: call.name ?? GEMINI_APPLY_TOOL_NAME,
    response,
  }
}

async function createGeminiLiveToken(): Promise<GeminiTokenPayload> {
  const response = await fetch(GEMINI_LIVE_TOKEN_ENDPOINT, { method: 'POST' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorFromPayload(payload) || `Gemini Live token request failed: ${response.status}`)
  }

  const token = geminiTokenFromPayload(payload)
  if (!token) {
    throw new Error('Gemini Live token unavailable.')
  }
  return token
}

export function geminiTokenFromPayload(payload: unknown): GeminiTokenPayload | null {
  if (!isRecord(payload) || payload.provider !== 'gemini-live') {
    return null
  }

  const token = stringValue(payload.token)
  const model = stringValue(payload.model)
  if (!token || !model) {
    return null
  }

  return {
    provider: 'gemini-live',
    token,
    model,
  }
}

async function startGeminiAudioInput(session: Session): Promise<GeminiAudioResources> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  const AudioContextClass = audioContextConstructor()
  if (!AudioContextClass) {
    throw new Error('AudioContext is unavailable.')
  }

  let audioContext: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  try {
    audioContext = new AudioContextClass()
    await audioContext.resume()
    source = audioContext.createMediaStreamSource(stream)
    processor = audioContext.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      try {
        const channel = event.inputBuffer.getChannelData(0)
        session.sendRealtimeInput({
          audio: {
            data: float32ToPcm16Base64(channel, audioContext?.sampleRate ?? 16000),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
      } catch (error) {
        debugRealtimeEvent({ type: 'voice.gemini.audio.failed', error: errorMessage(error) })
      }
    }
    source.connect(processor)
    processor.connect(audioContext.destination)

    return { stream, audioContext, source, processor }
  } catch (error) {
    processor?.disconnect()
    source?.disconnect()
    for (const track of stream.getTracks()) {
      track.stop()
    }
    void audioContext?.close().catch(() => undefined)
    throw error
  }
}

function stopGeminiSession(
  sessionRef: MutableRefObject<Session | null>,
  audioResourcesRef: MutableRefObject<GeminiAudioResources | null>,
) {
  const session = sessionRef.current
  stopGeminiAudioResources(audioResourcesRef)
  sessionRef.current = null
  if (!session) {
    return
  }

  try {
    session.sendRealtimeInput({ audioStreamEnd: true })
  } catch {
    // The socket may already be closed.
  }
  session.close()
}

function stopGeminiAudioResources(audioResourcesRef: MutableRefObject<GeminiAudioResources | null>) {
  const resources = audioResourcesRef.current
  audioResourcesRef.current = null
  if (!resources) {
    return
  }

  resources.processor.onaudioprocess = null
  resources.processor.disconnect()
  resources.source.disconnect()
  for (const track of resources.stream.getTracks()) {
    track.stop()
  }
  void resources.audioContext.close().catch(() => undefined)
}

function geminiLiveConnectConfig(): LiveConnectConfig {
  return {
    responseModalities: [GEMINI_TEXT_MODALITY],
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
              type: GEMINI_OBJECT_TYPE,
              properties: {
                command: {
                  type: GEMINI_STRING_TYPE,
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

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function errorFromPayload(payload: unknown) {
  return isRecord(payload) ? stringValue(payload.error) : ''
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

function audioContextConstructor() {
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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

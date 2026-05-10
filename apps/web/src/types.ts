import type { CanvasDoc, Patch, VoiceSegment } from '@voicecanvas/core'

export type RealtimeProviderName = 'openai-realtime' | 'gemini-live'

export type WorkspaceResponse = {
  canvas: CanvasDoc
  history: Patch[]
  pendingPatch: Patch | null
  status?: string
  patch?: Patch
  results?: WorkspaceResult[]
}

export type WorkspaceResult = {
  status?: string
  patch?: Patch
  segment?: VoiceSegment
}

export type RealtimeProviderResponse = {
  provider: RealtimeProviderName
  configured: boolean
  model: string
  sessionPath?: string
  tokenPath?: string
}

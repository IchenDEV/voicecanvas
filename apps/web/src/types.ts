import type { CanvasDoc, Patch } from '@voicecanvas/core'

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
}

export type RealtimeProviderResponse = {
  provider: 'doubao-asr'
  configured: boolean
  websocketPath: string
  sampleRate: number
  model: string
  resourceId: string
}

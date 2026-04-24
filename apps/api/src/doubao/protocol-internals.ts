import { gunzipSync } from 'node:zlib'
import type { WebSocket } from 'ws'
import type { DoubaoRealtimeConfig } from './config'

export const messageTypeFullClientRequest = 0b0001
export const messageTypeAudioOnlyRequest = 0b0010
export const messageTypeFullServerResponse = 0b1001
export const messageTypeServerErrorResponse = 0b1111
export const messageFlagsNoSequence = 0b0000
export const messageFlagsLastPackage = 0b0010
export const serializationJson = 0b0001
export const serializationNone = 0b0000
export const compressionGzip = 0b0001

const protocolVersion = 0b0001
const defaultHeaderSize = 0b0001

export function createDoubaoStartPayload(config: DoubaoRealtimeConfig) {
  return {
    user: { uid: 'voicecanvas' },
    audio: { format: 'pcm', codec: 'raw', rate: 16000, bits: 16, channel: 1 },
    request: {
      model_name: config.model,
      enable_itn: true,
      enable_punc: true,
      enable_ddc: false,
      show_utterances: true,
      result_type: 'full',
      enable_nonstream: true,
      end_window_size: 800,
    },
  }
}

export function createDoubaoHeader(messageType: number, messageFlags: number, serialization: number): Buffer {
  return Buffer.from([
    (protocolVersion << 4) | defaultHeaderSize,
    (messageType << 4) | messageFlags,
    (serialization << 4) | compressionGzip,
    0,
  ])
}

export function sizePrefix(payload: Buffer): Buffer {
  const prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(payload.length)
  return prefix
}

export function decodePayload(payload: Buffer, serialization: number, compression: number): string {
  const body = compression === compressionGzip ? gunzipSync(payload) : payload
  if (serialization === serializationJson || serialization === serializationNone) {
    return body.toString('utf8')
  }
  return ''
}

export function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data)
  }
  return Buffer.from(data)
}

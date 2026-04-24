import { gzipSync } from 'node:zlib'
import type { WebSocket } from 'ws'
import type { DoubaoRealtimeConfig } from './config'
import {
  createDoubaoHeader,
  createDoubaoStartPayload,
  decodePayload,
  messageFlagsLastPackage,
  messageFlagsNoSequence,
  messageTypeAudioOnlyRequest,
  messageTypeFullClientRequest,
  messageTypeFullServerResponse,
  messageTypeServerErrorResponse,
  serializationJson,
  serializationNone,
  sizePrefix,
  toBuffer,
} from './protocol-internals'

export type DoubaoAsrPayload = {
  result?: {
    text?: string
    utterances?: Array<{
      text?: string
      definite?: boolean
      start_time?: number
      end_time?: number
    }>
  }
  error?: string
  message?: string
}

export function createDoubaoFullClientRequest(config: DoubaoRealtimeConfig): Buffer {
  const payload = gzipSync(Buffer.from(JSON.stringify(createDoubaoStartPayload(config))))
  return Buffer.concat([
    createDoubaoHeader(messageTypeFullClientRequest, messageFlagsNoSequence, serializationJson),
    sizePrefix(payload),
    payload,
  ])
}

export function createDoubaoAudioOnlyRequest(audio: Buffer, isLastPackage = false): Buffer {
  const payload = gzipSync(audio)
  return Buffer.concat([
    createDoubaoHeader(
      messageTypeAudioOnlyRequest,
      isLastPackage ? messageFlagsLastPackage : messageFlagsNoSequence,
      serializationNone,
    ),
    sizePrefix(payload),
    payload,
  ])
}

export function parseDoubaoServerMessage(data: WebSocket.RawData): DoubaoAsrPayload | null {
  const buffer = toBuffer(data)
  if (buffer.length < 8) {
    return null
  }

  const headerSize = (buffer[0] & 0x0f) * 4
  const messageType = buffer[1] >> 4
  const serialization = buffer[2] >> 4
  const compression = buffer[2] & 0x0f
  return readServerPayload(buffer, headerSize, messageType, serialization, compression)
}

export function extractDefiniteTranscripts(payload: DoubaoAsrPayload): string[] {
  const utterances = payload.result?.utterances
  if (utterances?.length) {
    return utterances
      .filter((utterance) => utterance.definite)
      .map((utterance) => utterance.text?.trim())
      .filter((text): text is string => Boolean(text))
  }

  const text = payload.result?.text?.trim()
  return text ? [text] : []
}

export function createDoubaoSilenceChunk(sampleRate = 16000, durationMs = 100): Buffer {
  return Buffer.alloc(Math.round(sampleRate * (durationMs / 1000)) * 2)
}

export async function sendDoubaoSilenceTail(upstream: WebSocket) {
  for (let index = 0; index < 10; index += 1) {
    if (upstream.readyState !== 1) {
      return
    }
    upstream.send(createDoubaoAudioOnlyRequest(createDoubaoSilenceChunk()), { binary: true })
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
}

export function parseClientEvent(data: WebSocket.RawData): { type?: string; audio?: string } | null {
  try {
    const value = JSON.parse(toBuffer(data).toString('utf8')) as unknown
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as { type?: string; audio?: string }
    }
  } catch {
    return null
  }
  return null
}

function readServerPayload(buffer: Buffer, offsetStart: number, messageType: number, serialization: number, compression: number) {
  let offset = offsetStart
  if (messageType === messageTypeServerErrorResponse) {
    const errorCode = buffer.readInt32BE(offset)
    offset += 4
    const messageSize = buffer.readUInt32BE(offset)
    offset += 4
    const message = decodePayload(buffer.subarray(offset, offset + messageSize), serialization, compression)
    return { error: `Doubao ASR error ${errorCode}: ${message}` }
  }
  if (messageType !== messageTypeFullServerResponse || buffer.length < offset + 8) {
    return null
  }
  offset += 4
  const payloadSize = buffer.readUInt32BE(offset)
  offset += 4
  const payloadText = decodePayload(buffer.subarray(offset, offset + payloadSize), serialization, compression)
  return parsePayloadText(payloadText)
}

function parsePayloadText(payloadText: string): DoubaoAsrPayload | null {
  if (!payloadText) {
    return null
  }
  try {
    return JSON.parse(payloadText) as DoubaoAsrPayload
  } catch {
    return { message: payloadText }
  }
}

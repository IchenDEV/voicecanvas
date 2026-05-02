import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import {
  createDoubaoAudioOnlyRequest,
  createDoubaoFullClientRequest,
  createDoubaoSilenceChunk,
  extractDefiniteTranscripts,
  installDoubaoRealtimeProxy,
  resolveDoubaoRealtimeConfig,
  toClientCloseCode,
} from './realtime'
import {
  createDoubaoHeader,
  messageFlagsNoSequence,
  messageTypeFullServerResponse,
  serializationJson,
  sizePrefix,
} from './protocol-internals'

describe('Doubao realtime proxy helpers', () => {
  it('uses new-console single AK and hourly ASR resource by default', () => {
    const config = resolveDoubaoRealtimeConfig({
      env: {
        DOUBAO_API_KEY: 'speech-ak',
      },
    })

    expect(config?.apiKey).toBe('speech-ak')
    expect(config?.resourceId).toBe('volc.bigasr.sauc.duration')
    expect(config?.upstreamUrl).toBe('wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async')
  })

  it('maps upstream-only close codes to a client-safe error code', () => {
    expect(toClientCloseCode(1006)).toBe(1011)
    expect(toClientCloseCode(1015)).toBe(1011)
    expect(toClientCloseCode(4001)).toBe(4001)
  })

  it('builds Doubao binary requests', () => {
    const config = resolveDoubaoRealtimeConfig({
      env: {
        DOUBAO_API_KEY: 'speech-ak',
      },
    })

    expect(config).not.toBeNull()
    expect(createDoubaoFullClientRequest(config!)[0]).toBe(0x11)
    expect(createDoubaoAudioOnlyRequest(Buffer.from([1, 2, 3]))[1]).toBe(0x20)
    expect(createDoubaoAudioOnlyRequest(Buffer.alloc(0), true)[1]).toBe(0x22)
    expect(createDoubaoSilenceChunk()).toHaveLength(3200)
  })

  it('extracts definite transcripts only', () => {
    expect(
      extractDefiniteTranscripts({
        result: {
          utterances: [
            { text: 'partial', definite: false },
            { text: 'create signup flow', definite: true },
          ],
        },
      }),
    ).toEqual(['create signup flow'])
  })

  it('does not emit partial text when utterances are still non-definite', () => {
    expect(
      extractDefiniteTranscripts({
        result: {
          text: 'create sign',
          utterances: [{ text: 'create sign', definite: false }],
        },
      }),
    ).toEqual([])
  })

  it('emits repeated definite transcripts as separate voice commands', async () => {
    const upstreamServer = new WebSocketServer({ port: 0 })
    const proxyServer = createServer()
    const events: Array<{ type?: string; transcript?: string }> = []

    upstreamServer.on('connection', (upstream) => {
      upstream.once('message', () => {
        upstream.send(createServerTranscriptMessage('undo'))
        upstream.send(createServerTranscriptMessage('undo'))
      })
    })

    installDoubaoRealtimeProxy(proxyServer, {
      apiKey: 'speech-ak',
      model: 'bigmodel',
      resourceId: 'volc.bigasr.sauc.duration',
      upstreamUrl: serverUrl(upstreamServer),
    })
    await listen(proxyServer)

    const client = new WebSocket(`${serverUrl(proxyServer)}/api/realtime/doubao/ws`)
    client.on('message', (data) => {
      events.push(JSON.parse(data.toString()) as { type?: string; transcript?: string })
    })

    await waitForSocketOpen(client)
    await new Promise((resolve) => setTimeout(resolve, 100))

    client.close()
    await closeServer(proxyServer)
    await closeWebSocketServer(upstreamServer)

    expect(events.filter((event) => event.type === 'input_audio_transcription.completed')).toEqual([
      { type: 'input_audio_transcription.completed', transcript: 'undo' },
      { type: 'input_audio_transcription.completed', transcript: 'undo' },
    ])
  })
})

function createServerTranscriptMessage(text: string) {
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        result: {
          utterances: [{ text, definite: true }],
        },
      }),
    ),
  )

  return Buffer.concat([
    createDoubaoHeader(messageTypeFullServerResponse, messageFlagsNoSequence, serializationJson),
    Buffer.alloc(4),
    sizePrefix(payload),
    payload,
  ])
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
}

function serverUrl(server: Server | WebSocketServer) {
  const address = server.address() as AddressInfo
  return `ws://127.0.0.1:${address.port}`
}

function waitForSocketOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function closeWebSocketServer(server: WebSocketServer) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

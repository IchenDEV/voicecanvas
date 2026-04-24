import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import { resolveDoubaoRealtimeConfig, toClientCloseCode, type DoubaoRealtimeOptions } from './config'
import {
  createDoubaoAudioOnlyRequest,
  createDoubaoFullClientRequest,
  extractDefiniteTranscripts,
  parseClientEvent,
  parseDoubaoServerMessage,
  sendDoubaoSilenceTail,
} from './protocol'
import { sendClientEvent, type ClientSession } from './proxy-session'

type UpgradeServer = { on(event: 'upgrade', listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown }

export function installDoubaoRealtimeProxy(server: UpgradeServer, options: DoubaoRealtimeOptions = {}) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/realtime/doubao/ws') {
      return
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request)
    })
  })

  wss.on('connection', (client) => {
    const config = resolveDoubaoRealtimeConfig(options)
    if (!config) {
      client.send(JSON.stringify({ type: 'error', error: 'DOUBAO_API_KEY is required.' }))
      client.close(1011, 'missing_doubao_key')
      return
    }

    const session: ClientSession = {
      client,
      upstream: new WebSocket(config.upstreamUrl, {
        headers: {
          'X-Api-Key': config.apiKey,
          'X-Api-Resource-Id': config.resourceId,
          'X-Api-Connect-Id': `voicecanvas-${Date.now().toString(36)}`,
        },
      }),
      emittedTranscripts: new Set(),
      pendingAudio: [],
      pendingCommit: false,
    }
    bindUpstream(session, createDoubaoFullClientRequest(config))
    bindClient(session)
  })

  return wss
}

function bindUpstream(session: ClientSession, startRequest: Buffer) {
  session.upstream.on('open', () => {
    session.upstream.send(startRequest, { binary: true })
    flushPendingAudio(session)
    if (session.pendingCommit) {
      session.pendingCommit = false
      void sendDoubaoSilenceTail(session.upstream)
    }
    sendClientEvent(session.client, { type: 'voicecanvas.doubao.connected' })
  })

  session.upstream.on('message', (data) => {
    const payload = parseDoubaoServerMessage(data)
    if (!payload || session.client.readyState !== WebSocket.OPEN) {
      return
    }
    if (payload.error) {
      sendClientEvent(session.client, { type: 'error', error: payload.error })
      return
    }
    emitTranscripts(session, extractDefiniteTranscripts(payload))
  })

  session.upstream.on('error', (error) => {
    sendClientEvent(session.client, { type: 'error', error: error.message })
  })

  session.upstream.on('close', (code, reason) => {
    if (session.client.readyState === WebSocket.OPEN || session.client.readyState === WebSocket.CONNECTING) {
      session.client.close(toClientCloseCode(code), reason.toString())
    }
  })
}

function bindClient(session: ClientSession) {
  session.client.on('message', (data) => {
    const event = parseClientEvent(data)
    if (!event || event.type === 'transcription_session.update') {
      return
    }
    if (event.type === 'input_audio_buffer.commit') {
      handleCommit(session)
      return
    }
    if (event.type === 'input_audio_buffer.append' && event.audio) {
      handleAudioAppend(session, event.audio)
    }
  })

  session.client.on('close', () => {
    if (session.upstream.readyState === WebSocket.OPEN) {
      session.upstream.send(createDoubaoAudioOnlyRequest(Buffer.alloc(0), true), { binary: true })
    }
    session.upstream.close()
  })
}

function handleCommit(session: ClientSession) {
  session.pendingCommit = true
  sendClientEvent(session.client, { type: 'voicecanvas.doubao.audio_committed' })
  if (session.upstream.readyState === WebSocket.OPEN) {
    session.pendingCommit = false
    void sendDoubaoSilenceTail(session.upstream)
  }
}

function handleAudioAppend(session: ClientSession, audioBase64: string) {
  const audio = Buffer.from(audioBase64, 'base64')
  if (audio.length === 0) {
    return
  }
  if (session.upstream.readyState === WebSocket.OPEN) {
    session.upstream.send(createDoubaoAudioOnlyRequest(audio), { binary: true })
    return
  }
  session.pendingAudio.push(audio)
}

function flushPendingAudio(session: ClientSession) {
  for (const audio of session.pendingAudio.splice(0)) {
    session.upstream.send(createDoubaoAudioOnlyRequest(audio), { binary: true })
  }
}

function emitTranscripts(session: ClientSession, transcripts: string[]) {
  for (const transcript of transcripts) {
    if (session.emittedTranscripts.has(transcript)) {
      continue
    }
    session.emittedTranscripts.add(transcript)
    sendClientEvent(session.client, { type: 'input_audio_transcription.completed', transcript })
  }
}

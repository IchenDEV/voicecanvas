import { WebSocket } from 'ws'

export type ClientSession = {
  client: WebSocket
  upstream: WebSocket
  emittedTranscripts: Set<string>
  pendingAudio: Buffer[]
  pendingCommit: boolean
}

export function sendClientEvent(client: WebSocket, event: Record<string, unknown>) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(event))
  }
}

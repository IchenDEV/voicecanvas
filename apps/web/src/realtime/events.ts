type RealtimeEvent = {
  type?: string
  transcript?: string
  error?: string
}

export function parseRealtimeEvent(rawEvent: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(rawEvent) as unknown
    return isRecord(parsed) ? (parsed as RealtimeEvent) : null
  } catch {
    return null
  }
}

export function extractRealtimeTranscript(event: RealtimeEvent): string | null {
  if (
    event.type === 'conversation.item.input_audio_transcription.completed' ||
    event.type === 'input_audio_transcription.completed'
  ) {
    return cleanTranscript(event.transcript)
  }

  if (event.type?.includes('transcript')) {
    return cleanTranscript(event.transcript)
  }

  return null
}

function cleanTranscript(value: string | undefined): string | null {
  const transcript = value?.trim()
  return transcript ? transcript : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

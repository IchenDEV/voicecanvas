import { createId } from './ids'
import type { VoiceProviderName, VoiceSegment } from './types'

export function createTextSegment(text: string, provider: VoiceProviderName = 'text-sim'): VoiceSegment {
  const now = Date.now()
  return {
    id: createId('segment'),
    provider,
    finalTranscript: text.trim(),
    confidence: 1,
    startedAt: now,
    endedAt: now,
    status: 'captured',
  }
}

export function splitTextIntoSegments(input: string): string[] {
  return input
    .split(/\n|\.{2,}|[。！？!?]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

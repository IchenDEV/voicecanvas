import { describe, expect, it } from 'vitest'
import { extractRealtimeTranscript, parseRealtimeEvent } from './events'

describe('realtime event helpers', () => {
  it('extracts finalized Doubao transcription text', () => {
    expect(
      extractRealtimeTranscript({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'add OTP after phone verification',
      }),
    ).toBe('add OTP after phone verification')
  })

  it('ignores invalid realtime event JSON', () => {
    expect(parseRealtimeEvent('{broken')).toBeNull()
  })
})

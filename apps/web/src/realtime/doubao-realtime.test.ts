import { describe, expect, it } from 'vitest'
import { createDoubaoSessionUpdate, encodePCM16Base64, resampleLinear } from './doubao-realtime'

describe('doubao realtime helpers', () => {
  it('creates a transcription session update for streaming command capture', () => {
    expect(createDoubaoSessionUpdate()).toEqual({
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'bigmodel',
        },
        turn_detection: {
          type: 'server_vad',
        },
      },
    })
  })

  it('resamples float audio and encodes pcm16 base64', () => {
    const input = new Float32Array([0, 0.5, -0.5, 1])
    const resampled = resampleLinear(input, 4, 2)

    expect(Array.from(resampled)).toEqual([0, -0.5])
    expect(encodePCM16Base64(resampled)).toBe('AAAAwA==')
  })
})

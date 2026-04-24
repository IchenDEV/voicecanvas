import { describe, expect, it } from 'vitest'
import {
  createDoubaoAudioOnlyRequest,
  createDoubaoFullClientRequest,
  createDoubaoSilenceChunk,
  extractDefiniteTranscripts,
  resolveDoubaoRealtimeConfig,
  toClientCloseCode,
} from './realtime'

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
})

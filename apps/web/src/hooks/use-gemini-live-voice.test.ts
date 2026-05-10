import { describe, expect, it } from 'vitest'
import {
  float32ToPcm16Base64,
  geminiCommandFromFunctionCall,
  geminiLiveErrorStatus,
  geminiTokenFromPayload,
  geminiVoiceStatusLabel,
} from './use-gemini-live-voice'

describe('Gemini Live voice helpers', () => {
  it('maps Gemini voice state into the compact mic label', () => {
    expect(geminiVoiceStatusLabel('connecting')).toBe('Connecting')
    expect(geminiVoiceStatusLabel('listening')).toBe('Listening')
    expect(geminiVoiceStatusLabel('processing')).toBe('Planning')
    expect(geminiVoiceStatusLabel('error')).toBe('Voice error')
    expect(geminiVoiceStatusLabel('idle')).toBeNull()
  })

  it('reads Gemini Live token payloads', () => {
    expect(
      geminiTokenFromPayload({
        provider: 'gemini-live',
        model: 'gemini-3.1-flash-live-preview',
        token: 'token-test',
      }),
    ).toEqual({
      provider: 'gemini-live',
      model: 'gemini-3.1-flash-live-preview',
      token: 'token-test',
    })

    expect(geminiTokenFromPayload({ provider: 'openai-realtime', token: 'token-test' })).toBeNull()
    expect(geminiTokenFromPayload({ provider: 'gemini-live', token: '' })).toBeNull()
  })

  it('extracts VoiceCanvas commands from Gemini function calls', () => {
    expect(
      geminiCommandFromFunctionCall({
        name: 'apply_voice_command',
        args: { command: ' delete Mermaid rendering ' },
      }),
    ).toBe('delete Mermaid rendering')

    expect(geminiCommandFromFunctionCall({ name: 'other', args: { command: 'delete' } })).toBe('')
    expect(geminiCommandFromFunctionCall({ name: 'apply_voice_command', args: { command: 42 } })).toBe('')
  })

  it('maps Gemini startup failures to visible status text', () => {
    expect(geminiLiveErrorStatus(new Error('GEMINI_API_KEY is required.'))).toBe('Gemini key needed')
    expect(geminiLiveErrorStatus(new DOMException('Permission denied', 'NotAllowedError'))).toBe(
      'Mic permission denied',
    )
    expect(geminiLiveErrorStatus(new Error('Gemini Live token unavailable.'))).toBe('Gemini Live unavailable')
  })

  it('encodes browser audio samples as little-endian PCM16 base64', () => {
    const encoded = float32ToPcm16Base64(new Float32Array([-1, 0, 1]))

    expect(Array.from(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))).toEqual([0, 128, 0, 0, 255, 127])
  })

  it('downsamples browser audio before PCM16 encoding', () => {
    const encoded = float32ToPcm16Base64(new Float32Array([1, 1, 1, -1, -1, -1]), 48000, 16000)

    expect(Array.from(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))).toEqual([255, 127, 0, 128])
  })
})

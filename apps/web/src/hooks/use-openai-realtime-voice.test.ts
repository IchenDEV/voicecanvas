import { describe, expect, it } from 'vitest'
import {
  realtimeModelFromProviderPayload,
  realtimeVoiceErrorStatus,
  voiceStatusLabel,
} from './use-openai-realtime-voice'

describe('OpenAI realtime voice helpers', () => {
  it('maps component status into the compact mic label', () => {
    expect(voiceStatusLabel('connecting', 'connecting', false)).toBe('Connecting')
    expect(voiceStatusLabel('listening', 'listening', true)).toBe('Listening')
    expect(voiceStatusLabel('processing', 'processing', true)).toBe('Planning')
    expect(voiceStatusLabel('ready', 'executing', true)).toBe('Applying')
    expect(voiceStatusLabel('idle', 'idle', false)).toBeNull()
  })

  it('maps OpenAI realtime startup failures to visible status text', () => {
    expect(realtimeVoiceErrorStatus(new Error('OPENAI_API_KEY is required.'))).toBe('OpenAI key needed')
    expect(realtimeVoiceErrorStatus(new DOMException('Permission denied', 'NotAllowedError'))).toBe(
      'Mic permission denied',
    )
    expect(realtimeVoiceErrorStatus(new Error('Failed to establish Realtime WebRTC session: 401'))).toBe(
      'OpenAI Realtime unavailable',
    )
  })

  it('reads the browser realtime model from the API provider payload', () => {
    expect(
      realtimeModelFromProviderPayload({
        provider: 'openai-realtime',
        configured: true,
        model: 'gpt-realtime-mini',
        sessionPath: '/api/realtime/openai/session',
      }),
    ).toBe('gpt-realtime-mini')
    expect(
      realtimeModelFromProviderPayload({
        defaultProvider: 'openai-realtime',
        providers: [
          {
            provider: 'openai-realtime',
            configured: true,
            model: 'gpt-realtime-2',
            sessionPath: '/api/realtime/openai/session',
          },
          {
            provider: 'gemini-live',
            configured: true,
            model: 'gemini-3.1-flash-live-preview',
            tokenPath: '/api/realtime/gemini/token',
          },
        ],
      }),
    ).toBe('gpt-realtime-2')

    expect(realtimeModelFromProviderPayload({ provider: 'other', model: 'gpt-realtime-mini' })).toBeNull()
    expect(realtimeModelFromProviderPayload({ provider: 'openai-realtime', model: '' })).toBeNull()
  })
})

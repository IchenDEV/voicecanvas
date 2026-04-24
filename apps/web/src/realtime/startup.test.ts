import { describe, expect, it, vi } from 'vitest'
import { realtimeErrorStatus, withTimeout } from './startup'

describe('realtime startup helpers', () => {
  it('fails pending startup promises with a visible timeout reason', async () => {
    vi.useFakeTimers()

    const startup = withTimeout(new Promise(() => undefined), 1000, 'Microphone permission timed out.')
    const assertion = expect(startup).rejects.toThrow('Microphone permission timed out.')
    await vi.advanceTimersByTimeAsync(1000)

    await assertion
    vi.useRealTimers()
  })

  it('maps browser and provider startup failures to user-facing states', () => {
    expect(realtimeErrorStatus(new DOMException('Permission denied', 'NotAllowedError'))).toBe('Mic permission denied')
    expect(realtimeErrorStatus(new Error('Microphone permission timed out.'))).toBe('Mic permission needed')
    expect(realtimeErrorStatus(new Error('Realtime socket timed out.'))).toBe('Doubao ASR unreachable')
    expect(realtimeErrorStatus(new Error('Audio engine timed out.'))).toBe('Audio engine blocked')
  })
})

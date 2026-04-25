import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { postJson } from './test-helpers'

describe('VoiceCanvas edit command API', () => {
  it('applies rename and delete commands in the same continuous stream', async () => {
    const app = createApp()
    const response = await postJson(app, '/api/commands/text-segment', {
      text: 'create signup flow... change phone number step to collect mobile number... delete verify phone step...',
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('applied')
    expect(payload.history).toHaveLength(3)
    expect(payload.canvas.nodes.some((node: { label: string }) => node.label === 'Collect mobile number')).toBe(true)
    expect(payload.canvas.nodes.some((node: { label: string }) => node.label === 'Verify phone')).toBe(false)
  })
})

import { Mic } from 'lucide-react'
import type { RealtimeProviderName } from '../types'

type VoiceCapsuleProps = {
  isRealtimeActive: boolean
  provider: RealtimeProviderName
  status: string
  onProviderChange: (provider: RealtimeProviderName) => void
  onToggle: () => void
}

const realtimeProviderOptions: Array<{ id: RealtimeProviderName; label: string }> = [
  { id: 'openai-realtime', label: 'OpenAI' },
  { id: 'gemini-live', label: 'Gemini' },
]

export function VoiceCapsule({
  isRealtimeActive,
  provider,
  status,
  onProviderChange,
  onToggle,
}: VoiceCapsuleProps) {
  return (
    <section className="voice-capsule" aria-label="Voice input">
      <button
        type="button"
        className={isRealtimeActive ? 'mic-orb is-active' : 'mic-orb'}
        onClick={onToggle}
        aria-label={isRealtimeActive ? 'Stop realtime microphone' : 'Start realtime microphone'}
      >
        <Mic size={18} />
      </button>
      <span className="voice-live-status" role="status">
        {status}
      </span>
      <div className="voice-provider-switch" role="group" aria-label="Realtime voice provider">
        {realtimeProviderOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={provider === option.id ? 'voice-provider-button is-selected' : 'voice-provider-button'}
            onClick={() => onProviderChange(option.id)}
            aria-pressed={provider === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

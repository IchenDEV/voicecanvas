import { Mic } from 'lucide-react'

type VoiceCapsuleProps = {
  isRealtimeActive: boolean
  status: string
  onToggle: () => void
}

export function VoiceCapsule({ isRealtimeActive, status, onToggle }: VoiceCapsuleProps) {
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
    </section>
  )
}

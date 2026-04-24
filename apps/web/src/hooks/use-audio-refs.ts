import { useMemo, useRef } from 'react'
import type { AudioRefs } from '../realtime/audio'

export function useAudioRefs(): AudioRefs {
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const audioMuteRef = useRef<GainNode | null>(null)
  const speechActiveRef = useRef(false)
  const lastVoiceAtRef = useRef(0)
  const lastCommitAtRef = useRef(0)

  return useMemo(
    () => ({
      audioContextRef,
      audioSourceRef,
      audioProcessorRef,
      audioMuteRef,
      speechActiveRef,
      lastVoiceAtRef,
      lastCommitAtRef,
    }),
    [
      audioContextRef,
      audioSourceRef,
      audioProcessorRef,
      audioMuteRef,
      speechActiveRef,
      lastVoiceAtRef,
      lastCommitAtRef,
    ],
  )
}

export function resetAudioRefs(refs: AudioRefs) {
  refs.audioProcessorRef.current = null
  refs.audioSourceRef.current = null
  refs.audioMuteRef.current = null
  refs.audioContextRef.current = null
  refs.speechActiveRef.current = false
}

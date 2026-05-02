import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRealtimeProvider, startDoubaoRealtimeMic } from '../realtime/doubao-mic-connection'
import { extractRealtimeTranscript, parseRealtimeEvent } from '../realtime/events'
import { getUserMediaWithTimeout } from '../realtime/audio'
import { realtimeErrorStatus, withTimeout } from '../realtime/startup'
import { resetAudioRefs, useAudioRefs } from './use-audio-refs'

type DoubaoMicOptions = {
  onTranscript: (transcript: string) => Promise<unknown>
  setStatus: (status: string) => void
}

export function useDoubaoMic({ onTranscript, setStatus }: DoubaoMicOptions) {
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const doubaoSocketRef = useRef<WebSocket | null>(null)
  const refs = useAudioRefs()

  const stopRealtimeMic = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    doubaoSocketRef.current?.close()
    refs.audioProcessorRef.current?.disconnect()
    refs.audioSourceRef.current?.disconnect()
    refs.audioMuteRef.current?.disconnect()
    void refs.audioContextRef.current?.close()
    mediaStreamRef.current = null
    doubaoSocketRef.current = null
    resetAudioRefs(refs)
    setIsRealtimeActive(false)
  }, [refs])

  const handleRealtimeEvent = useCallback(
    async (rawEvent: string) => {
      const event = parseRealtimeEvent(rawEvent)
      const transcript = event ? extractRealtimeTranscript(event) : null

      if (transcript) {
        setStatus(`Heard: ${transcript}`)
        await onTranscript(transcript)
        return
      }
      if (event?.type === 'voicecanvas.doubao.connected') {
        setStatus('Listening')
        return
      }
      if (event?.type === 'voicecanvas.doubao.audio_committed') {
        setStatus('Processing speech')
        return
      }
      if (event?.type?.includes('error')) {
        setStatus(event.error ?? 'Doubao realtime error')
      }
    },
    [onTranscript, setStatus],
  )

  const toggleRealtimeMic = useCallback(async () => {
    if (isRealtimeActive) {
      stopRealtimeMic()
      setStatus('Ready')
      return
    }

    setStatus('Allow microphone')
    try {
      const provider = await withTimeout(fetchRealtimeProvider(), 8_000, 'Realtime provider timed out.')
      const stream = await getUserMediaWithTimeout()
      mediaStreamRef.current = stream
      setStatus('Connecting ASR')
      const socket = await startDoubaoRealtimeMic({ provider, refs, stream, setStatus, handleRealtimeEvent })
      doubaoSocketRef.current = socket
      setIsRealtimeActive(true)
      setStatus('Listening')
    } catch (error) {
      stopRealtimeMic()
      setStatus(realtimeErrorStatus(error))
    }
  }, [handleRealtimeEvent, isRealtimeActive, refs, setStatus, stopRealtimeMic])

  useEffect(() => stopRealtimeMic, [stopRealtimeMic])

  return { isRealtimeActive, toggleRealtimeMic }
}

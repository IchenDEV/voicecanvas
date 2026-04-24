import {
  calculateRms,
  createDoubaoAudioAppend,
  createDoubaoAudioCommit,
  encodePCM16Base64,
  resampleLinear,
} from './doubao-realtime'
import { withTimeout } from './startup'
import type { MutableRefObject } from 'react'

export type AudioRefs = {
  audioContextRef: MutableRefObject<AudioContext | null>
  audioSourceRef: MutableRefObject<MediaStreamAudioSourceNode | null>
  audioProcessorRef: MutableRefObject<ScriptProcessorNode | null>
  audioMuteRef: MutableRefObject<GainNode | null>
  speechActiveRef: MutableRefObject<boolean>
  lastVoiceAtRef: MutableRefObject<number>
  lastCommitAtRef: MutableRefObject<number>
}

type PumpOptions = {
  refs: AudioRefs
  stream: MediaStream
  socket: WebSocket
  targetSampleRate: number
  setStatus: (status: string) => void
}

export async function getUserMediaWithTimeout() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API unavailable.')
  }

  let timedOut = false
  const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true })
  void streamPromise.then((lateStream) => {
    if (timedOut) {
      lateStream.getTracks().forEach((track) => track.stop())
    }
  })

  try {
    return await withTimeout(streamPromise, 12_000, 'Microphone permission timed out.')
  } catch (error) {
    timedOut = true
    throw error
  }
}

export async function startDoubaoAudioPump(options: PumpOptions) {
  const AudioContextConstructor = window.AudioContext ?? getWebKitAudioContext()
  if (!AudioContextConstructor) {
    throw new Error('AudioContext is unavailable.')
  }

  const audioContext = new AudioContextConstructor()
  const source = audioContext.createMediaStreamSource(options.stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const mute = audioContext.createGain()
  mute.gain.value = 0
  assignAudioRefs(options.refs, audioContext, source, processor, mute)

  processor.onaudioprocess = (event) => {
    sendDoubaoAudioFrame(options, event.inputBuffer.getChannelData(0), audioContext.sampleRate)
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioContext.destination)

  if (audioContext.state === 'suspended') {
    await withTimeout(audioContext.resume(), 3_000, 'Audio engine timed out.')
  }
}

function sendDoubaoAudioFrame(options: PumpOptions, input: Float32Array, sourceSampleRate: number) {
  if (options.socket.readyState !== WebSocket.OPEN) {
    return
  }

  const now = performance.now()
  updateSpeechState(options, input, now)
  if (!options.refs.speechActiveRef.current) {
    return
  }

  const resampled = resampleLinear(input, sourceSampleRate, options.targetSampleRate)
  options.socket.send(JSON.stringify(createDoubaoAudioAppend(encodePCM16Base64(resampled))))
  commitAfterPause(options, now)
}

function updateSpeechState(options: PumpOptions, input: Float32Array, now: number) {
  if (calculateRms(input) <= 0.006) {
    return
  }
  if (!options.refs.speechActiveRef.current) {
    options.setStatus('Hearing you')
  }
  options.refs.speechActiveRef.current = true
  options.refs.lastVoiceAtRef.current = now
}

function commitAfterPause(options: PumpOptions, now: number) {
  const refs = options.refs
  if (now - refs.lastVoiceAtRef.current <= 850 || now - refs.lastCommitAtRef.current <= 1200) {
    return
  }
  options.socket.send(JSON.stringify(createDoubaoAudioCommit()))
  refs.speechActiveRef.current = false
  refs.lastCommitAtRef.current = now
  options.setStatus('Processing speech')
}

function assignAudioRefs(
  refs: AudioRefs,
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  processor: ScriptProcessorNode,
  mute: GainNode,
) {
  refs.audioContextRef.current = context
  refs.audioSourceRef.current = source
  refs.audioProcessorRef.current = processor
  refs.audioMuteRef.current = mute
  refs.lastVoiceAtRef.current = 0
  refs.lastCommitAtRef.current = 0
}

function getWebKitAudioContext() {
  return (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

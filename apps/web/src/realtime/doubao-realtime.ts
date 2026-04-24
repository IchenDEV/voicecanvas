export type DoubaoSessionUpdate = {
  type: 'transcription_session.update'
  session: {
    input_audio_format: 'pcm16'
    input_audio_transcription: {
      model: 'bigmodel'
    }
    turn_detection: {
      type: 'server_vad'
    }
  }
}

export function createDoubaoSessionUpdate(): DoubaoSessionUpdate {
  return {
    type: 'transcription_session.update',
    session: {
      input_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'bigmodel',
      },
      turn_detection: {
        type: 'server_vad',
      },
    },
  }
}

export function createDoubaoAudioAppend(audio: string) {
  return {
    type: 'input_audio_buffer.append',
    audio,
  }
}

export function createDoubaoAudioCommit() {
  return {
    type: 'input_audio_buffer.commit',
  }
}

export function resampleLinear(input: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return input
  }

  const ratio = fromSampleRate / toSampleRate
  const outputLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outputLength)

  for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
    const inputIndex = outputIndex * ratio
    const before = Math.floor(inputIndex)
    const after = Math.min(before + 1, input.length - 1)
    const weight = inputIndex - before
    output[outputIndex] = input[before] * (1 - weight) + input[after] * weight
  }

  return output
}

export function encodePCM16Base64(input: Float32Array): string {
  const bytes = new Uint8Array(input.length * 2)
  const view = new DataView(bytes.buffer)

  for (let index = 0; index < input.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, input[index]))
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    view.setInt16(index * 2, sample, true)
  }

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export function calculateRms(input: Float32Array): number {
  if (input.length === 0) {
    return 0
  }

  let sum = 0
  for (const sample of input) {
    sum += sample * sample
  }

  return Math.sqrt(sum / input.length)
}

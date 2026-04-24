export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

export function realtimeErrorStatus(error: unknown) {
  if (!isErrorLike(error)) {
    return 'Mic unavailable'
  }

  const message = error.message
  const name = error.name ?? ''

  if (message.includes('DOUBAO_API_KEY')) {
    return 'Doubao ASR needs API key'
  }

  if (name === 'NotAllowedError' || message.includes('Permission denied')) {
    return 'Mic permission denied'
  }

  if (name === 'NotFoundError' || message.includes('Requested device not found')) {
    return 'No microphone found'
  }

  if (message.includes('Microphone permission timed out')) {
    return 'Mic permission needed'
  }

  if (message.includes('Realtime provider timed out') || message.includes('Realtime socket timed out')) {
    return 'Doubao ASR unreachable'
  }

  if (message.includes('Audio engine timed out') || message.includes('AudioContext')) {
    return 'Audio engine blocked'
  }

  return 'Mic unavailable'
}

function isErrorLike(error: unknown): error is { message: string; name?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

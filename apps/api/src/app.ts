import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { z } from 'zod'
import { patchApplyRequestSchema, patchConfirmRequestSchema, textSegmentRequestSchema } from './workspace/schemas'
import type { CreateAppOptions } from './workspace/types'
import { resolveDoubaoRealtimeConfig } from './doubao/realtime'
import { createWorkspaceStore } from './workspace/store'

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono()
  const store = createWorkspaceStore(options)
  app.use('*', cors())

  app.get('/', (c) => c.json({ name: 'VoiceCanvas API', status: 'ready' }))
  app.get('/health', (c) => c.json({ ok: true }))
  app.get('/api/canvas', (c) => c.json(store.snapshot()))
  app.get('/api/realtime/provider', (c) => c.json(realtimeProviderPayload(options)))
  app.post('/api/dev/reset', (c) => c.json(store.reset()))

  app.post('/api/commands/text-segment', async (c) => {
    const parsed = await parseJsonBody(c, textSegmentRequestSchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const result = await store.processTextInput(parsed.data.text, parsed.data.selectedObjectIds)
    if ('error' in result) {
      return c.json({ error: result.error }, 400)
    }
    return c.json(result)
  })

  app.post('/api/patch/compile', async (c) => {
    const parsed = await parseJsonBody(c, textSegmentRequestSchema)
    if (!parsed.ok) {
      return parsed.response
    }

    return c.json(await store.compileOnly(parsed.data.text, parsed.data.selectedObjectIds))
  })

  app.post('/api/patch/apply', async (c) => {
    const parsed = await parseJsonBody(c, patchApplyRequestSchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const result = store.applyDraft(parsed.data.patch)
    return c.json(result, result.status === 'failed' ? 422 : 200)
  })

  app.post('/api/patch/confirm', async (c) => {
    const parsed = await parseJsonBody(c, patchConfirmRequestSchema)
    if (!parsed.ok) {
      return parsed.response
    }

    const result = store.confirm(parsed.data.candidateId)
    const statusCode = result.status === 'failed' ? 422 : result.status === 'no_pending_patch' ? 409 : 200
    return c.json(result, statusCode)
  })

  app.post('/api/patch/undo', (c) => c.json(store.undo()))
  app.get('/api/export/json', (c) => c.json(store.snapshot().canvas))
  app.get('/api/export/png', (c) => {
    return c.json({ error: 'PNG export is reserved for Alpha after browser rendering is stable.' }, 501)
  })

  return app
}

async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>) {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return { ok: false as const, response: c.json({ error: 'Invalid JSON body.' }, 400) }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return { ok: false as const, response: c.json({ error: parsed.error.flatten() }, 400) }
  }

  return { ok: true as const, data: parsed.data }
}

function realtimeProviderPayload(options: CreateAppOptions) {
  const config = resolveDoubaoRealtimeConfig({
    apiKey: options.doubaoAPIKey,
    model: options.doubaoAsrModel,
    resourceId: options.doubaoAsrResourceId,
  })

  return {
    provider: 'doubao-asr',
    configured: Boolean(config),
    model: config?.model ?? options.doubaoAsrModel ?? process.env.DOUBAO_ASR_MODEL ?? 'bigmodel',
    resourceId: config?.resourceId ?? options.doubaoAsrResourceId ?? process.env.DOUBAO_ASR_RESOURCE_ID ?? 'volc.bigasr.sauc.duration',
    websocketPath: '/api/realtime/doubao/ws',
    sampleRate: 16000,
  }
}

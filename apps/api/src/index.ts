import { serve } from '@hono/node-server'
import { createApp } from './app'
import { installDoubaoRealtimeProxy } from './doubao/realtime'

const server = serve(
  {
    fetch: createApp().fetch,
    port: Number(process.env.PORT ?? 8787),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

installDoubaoRealtimeProxy(server)

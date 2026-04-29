import { serve } from '@hono/node-server'
import { createApp } from './app'

serve(
  {
    fetch: createApp().fetch,
    port: Number(process.env.PORT ?? 8787),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

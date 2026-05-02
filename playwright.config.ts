import { defineConfig, devices } from '@playwright/test'

const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1'
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5177)
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 8787)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${webPort}`
const apiURL = process.env.PLAYWRIGHT_API_URL ?? `http://${host}:${apiPort}`

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `PORT=${apiPort} pnpm dev:api`,
      url: `${apiURL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `VITE_API_TARGET=${apiURL} VITE_HOST=${host} VITE_DEV_PORT=${webPort} VITE_STRICT_PORT=true pnpm dev:web`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

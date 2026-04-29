import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173)
const webBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`
const apiBaseURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8787'

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: webBaseURL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm dev:api',
      url: `${apiBaseURL}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: `pnpm --dir apps/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webBaseURL,
      reuseExistingServer: true,
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

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:8787/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:5173',
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

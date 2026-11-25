import { defineConfig, devices } from '@playwright/test'

// E2E runs against a local Supabase (npm run db:start) and the Vite dev server.
// Run: npm run e2e   (add `--trace off` unless you are debugging a failure)
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

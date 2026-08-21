import { defineConfig, devices } from '@playwright/test';

// Admin E2E. Requires the API to be running (Next's dev proxies /api → :3100) and a
// seeded user. Run `pnpm exec playwright install chromium` once to
// download the browser. Config designed to run against the admin's `pnpm dev`.
const PORT = 3200;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // 130+ specs covering distinct menu.yaml routes — under `pnpm dev` (Next
  // compiles each route on demand, on the first visit), the default parallelism
  // (1 worker per core) causes several first-compilations to run concurrently and some
  // to exceed the navigation timeout under load. A lower cap gives the dev
  // server some breathing room; it still runs much faster than serial.
  workers: 6,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // 1) authenticates once and saves the storageState reused by the others.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  // Starts the admin automatically (unless E2E_BASE_URL points to a server that's
  // already running). The API needs to be running separately (docker-compose + pnpm dev).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

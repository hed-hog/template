import { defineConfig, devices } from '@playwright/test';

// E2E do admin. Requer a API viva (o dev do Next faz proxy /api → :3100) e um
// usuário semeado. Rode `pnpm exec playwright install chromium` uma vez para
// baixar o browser. Config pensada para rodar contra o `pnpm dev` do admin.
const PORT = 3200;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Regenera e2e/generated/*.spec.ts a partir de libraries/*/hedhog/frontend/e2e
  // antes de cada run, para refletir quais libraries estão presentes no projeto.
  globalSetup: require.resolve('./e2e/generate-specs.mjs'),
  fullyParallel: true,
  // 130+ specs cobrindo rotas distintas do menu.yaml — sob o `pnpm dev` (Next
  // compila cada rota sob demanda, na primeira visita), o paralelismo padrão
  // (1 worker por core) faz várias primeiras-compilações concorrerem e algumas
  // estourarem o timeout de navegação sob carga. Cap menor dá folga ao dev
  // server; ainda assim roda bem mais rápido que serial.
  workers: 6,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // 1) autentica uma vez e salva o storageState reutilizado pelos demais.
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
  // Sobe o admin automaticamente (a menos que E2E_BASE_URL aponte para um server
  // já em pé). A API precisa estar rodando à parte (docker-compose + pnpm dev).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

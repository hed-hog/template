// Captures real screenshots of the admin-panel flows described in the
// hedhog docs site's /help page (apps/hedhog) and writes them to
// apps/hedhog/public/help/*.png, replacing the hand-drawn illustrations
// used as a fallback there.
//
// This drives the ADMIN app's own UI (that's where Enterprise accounts,
// courses, classes and students actually get created) — it lives here,
// not in apps/hedhog, because this is the app with Playwright + the e2e
// login fixture already set up.
//
// Requires a running admin dev server + API (same prerequisites as the e2e
// suite — see playwright.config.ts) and network access to localhost, which
// isn't available in every sandboxed environment. Run locally with:
//
//   pnpm exec playwright install chromium   # once
//   pnpm dev                                # in one terminal
//   node scripts/capture-help-screenshots.mjs
//
// Env vars (same defaults as e2e/auth.setup.ts):
//   E2E_BASE_URL   default http://localhost:3200
//   E2E_EMAIL      default root@hedhog.com
//   E2E_PASSWORD   default changeme

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', '..', 'hedhog', 'public', 'help');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3200';
const EMAIL = process.env.E2E_EMAIL || 'root@hedhog.com';
const PASSWORD = process.env.E2E_PASSWORD || 'changeme#05';

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(15_000);

  // Diagnostics: the previous run showed the login button stuck on "Logging
  // In..." forever — neither success nor error — which means the request
  // itself never settled from the page's point of view. Log every request
  // Playwright sees so we can tell whether it was ever sent, and what (if
  // anything) came back.
  page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));
  page.on('request', (req) => {
    if (req.url().includes('/auth/')) console.log('[request]', req.method(), req.url());
  });
  page.on('requestfailed', (req) => {
    console.log('[requestfailed]', req.method(), req.url(), req.failure()?.errorText);
  });
  page.on('response', (res) => {
    if (res.url().includes('/auth/')) console.log('[response]', res.status(), res.url());
  });

  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /entrar|acessar|log\s*in/i }).click();

  // Race navigation against the login form's own error Alert (role="alert",
  // shown inline without leaving /login) so a wrong EMAIL/PASSWORD produces a
  // clear message instead of a generic 30s waitForURL timeout.
  const navigated = page
    .waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 30_000,
    })
    .then(() => 'navigated');
  const errored = page
    .getByRole('alert')
    .waitFor({ timeout: 30_000 })
    .then(() => 'errored');

  const outcome = await Promise.race([navigated, errored]).catch(
    () => 'timeout'
  );

  if (outcome !== 'navigated') {
    const alertText = await page
      .getByRole('alert')
      .innerText()
      .catch(() => null);
    const debugPath = join(OUT_DIR, '_debug-login-failed.png');
    await page.screenshot({ path: debugPath }).catch(() => {});
    await browser.close().catch(() => {});
    throw new Error(
      alertText
        ? `Login falhou: "${alertText}". Confira E2E_EMAIL/E2E_PASSWORD (padrão: ${EMAIL} / ${PASSWORD}) — screenshot em ${debugPath}`
        : `Login não navegou para fora de /login em 30s e nenhum alerta apareceu — confira se ${BASE_URL} é o admin certo e se a API está no ar. Screenshot em ${debugPath}`
    );
  }

  // ── 1. Enterprise list ──────────────────────────────────────────────────
  console.log('Capturing enterprise-list.png');
  await page.goto(`${BASE_URL}/lms/enterprise`);
  await page.getByRole('button', { name: /nova conta/i }).waitFor();
  await page.screenshot({ path: join(OUT_DIR, 'enterprise-list.png') });

  // ── 2. Enterprise create sheet ──────────────────────────────────────────
  console.log('Capturing enterprise-create-sheet.png');
  await page.getByRole('button', { name: /nova conta/i }).click();
  await page.getByText(/nova conta enterprise/i).waitFor();
  await page.screenshot({ path: join(OUT_DIR, 'enterprise-create-sheet.png') });
  await page.keyboard.press('Escape');

  // ── 3. Enterprise detail — Turmas tab ───────────────────────────────────
  console.log('Capturing enterprise-detail-tabs.png');
  const firstRow = page.locator('table tbody tr, [role="row"]').first();
  await firstRow.click();
  await page.waitForURL(/\/lms\/enterprise\/\d+/);
  await page.getByRole('tab', { name: /turmas/i }).click();
  await page.screenshot({ path: join(OUT_DIR, 'enterprise-detail-tabs.png') });

  // ── 4. Student CSV import ───────────────────────────────────────────────
  console.log('Capturing student-import.png');
  await page.getByRole('tab', { name: /alunos/i }).click();
  await page.getByRole('button', { name: /importar csv/i }).click();
  await page.getByText(/importar alunos/i).waitFor();
  await page.screenshot({ path: join(OUT_DIR, 'student-import.png') });

  await browser.close();
  console.log(`Done. Screenshots written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

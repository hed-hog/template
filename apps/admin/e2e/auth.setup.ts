import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

// Authenticates once and persists the state (cookies + localStorage) for the other
// tests to reuse via storageState — avoids logging in on every spec.
//
// NOTE: the selectors below are a starting point; adjust them to the actual labels
// of the admin login form (apps/admin/src/app/.../login).
const authFile = path.join(__dirname, '.auth/user.json');
const EMAIL = process.env.E2E_EMAIL || 'root@hedhog.com';
const PASSWORD = process.env.E2E_PASSWORD || 'changeme';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  // The show/hide password button has aria-label "Show password", which also
  // matches /password/i — so we target the input by autocomplete, which is
  // stable and unaffected by the FormControl wrapper.
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  // "Log In" (en) has a space between the words — /login/i wouldn't match.
  await page.getByRole('button', { name: /entrar|acessar|log\s*in/i }).click();

  // After logging in, the app navigates away from /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });

  await page.context().storageState({ path: authFile });
});

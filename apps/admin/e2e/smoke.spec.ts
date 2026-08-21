import { test, expect } from '@playwright/test';
import { expectPageLoads } from './support';

// Minimal smoke test that works on a fresh checkout of the template, with no
// library installed: confirms that the authenticated session (via storageState from
// auth.setup.ts) loads the home page without falling back to /login. Once the first
// library is installed, add per-module specs covering their actual routes
// (see git history for the pattern used by removed module specs).
test.describe('Smoke', () => {
  test('home loads authenticated without redirecting to /login', async ({
    page,
  }) => {
    await expectPageLoads(page, '/');
  });

  test('does not redirect to /login on a basic navigation', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

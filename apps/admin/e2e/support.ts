import { expect, type Page } from '@playwright/test';

// Generic smoke test: confirms that the page loads for the admin profile
// (root@hedhog.com, the only login used in the admin e2e — almost every route in
// the libraries' menu.yaml grants access to the "admin" role, see auth.setup.ts),
// without falling back to /login and without a blank screen. It doesn't assert
// anything about the specific content of each screen: most routes use the same
// `entity-list` listing component (see apps/admin/src/components/entity-list/),
// so the heading varies by each module's config, not by page.
export async function expectPageLoads(page: Page, url: string) {
  await page.goto(url);
  await expect(page).not.toHaveURL(/\/login(?:[/?]|$)/);
  // .first(): some screens (home with unavailable dashboard, inbox, mcp_chat)
  // nest their own <main> inside the shell's <main data-slot="sidebar-inset"> —
  // pre-existing landmark duplication, doesn't affect the test.
  await expect(page.getByRole('main').first()).toBeVisible();
}

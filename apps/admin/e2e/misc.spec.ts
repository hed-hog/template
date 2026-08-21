import { test } from '@playwright/test';
import { expectPageLoads } from './support';

// Home pós-login e os módulos de página única (sem sub-rotas).
test.describe('Home e módulos de página única', () => {
  const urls = ['/', '/category', '/tag', '/inbox'];

  for (const url of urls) {
    test(`${url} carrega sem crash`, async ({ page }) => {
      await expectPageLoads(page, url);
    });
  }
});

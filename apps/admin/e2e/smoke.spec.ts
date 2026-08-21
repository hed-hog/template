import { test, expect } from '@playwright/test';

// Fluxo crítico ponta a ponta: autenticado (via storageState do setup) →
// abre uma listagem → navega ao detalhe. Ajuste a rota e os seletores às páginas
// reais do admin (aqui usamos commerce/customers como exemplo de lista).
test.describe('Fluxo de listagem', () => {
  test('abre uma página de listagem sem ser redirecionado para /login', async ({
    page,
  }) => {
    await page.goto('/commerce/customers');

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('navega para o detalhe ao clicar no primeiro item', async ({ page }) => {
    await page.goto('/commerce/customers');

    const firstItem = page
      .locator('a[href*="/commerce/customers/"], [role="row"]')
      .first();

    if ((await firstItem.count()) === 0) {
      test.skip(true, 'Lista vazia — sem item para abrir o detalhe.');
      return;
    }

    await firstItem.click();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

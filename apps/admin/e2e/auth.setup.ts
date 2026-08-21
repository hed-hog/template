import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

// Autentica uma vez e persiste o estado (cookies + localStorage) para os demais
// testes reutilizarem via storageState — evita logar em cada spec.
//
// NOTA: os seletores abaixo são um ponto de partida; ajuste aos rótulos reais do
// formulário de login do admin (apps/admin/src/app/.../login).
const authFile = path.join(__dirname, '.auth/user.json');
const EMAIL = process.env.E2E_EMAIL || 'root@hedhog.com';
const PASSWORD = process.env.E2E_PASSWORD || 'changeme';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  // O botão de mostrar/ocultar senha tem aria-label "Show password", que também
  // casa com /password/i — por isso miramos o input pelo autocomplete, que é
  // estável e não é afetado pelo wrapper do FormControl.
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  // "Log In" (en) tem espaço entre as palavras — /login/i não casaria.
  await page.getByRole('button', { name: /entrar|acessar|log\s*in/i }).click();

  // Após logar, o app sai de /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,
  });

  await page.context().storageState({ path: authFile });
});

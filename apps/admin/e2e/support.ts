import { expect, type Page } from '@playwright/test';

// Smoke genérico: confirma que a página carrega para o perfil admin
// (root@hedhog.com, único login usado no e2e do admin — quase toda rota do
// menu.yaml das libraries libera o role "admin", ver auth.setup.ts), sem cair
// no /login e sem tela em branco. Não afirma nada sobre o conteúdo específico
// de cada tela: a maioria das rotas usa o mesmo componente de listagem
// `entity-list` (ver apps/admin/src/components/entity-list/), então o
// heading varia por config de cada módulo, não por página.
export async function expectPageLoads(page: Page, url: string) {
  await page.goto(url);
  await expect(page).not.toHaveURL(/\/login(?:[/?]|$)/);
  // .first(): algumas telas (home com dashboard indisponível, inbox, mcp_chat)
  // aninham um <main> próprio dentro do <main data-slot="sidebar-inset"> do
  // shell — duplicidade pré-existente de landmark, não afeta o teste.
  await expect(page.getByRole('main').first()).toBeVisible();
}

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Config Vitest base para apps de frontend React/Next (jsdom + plugin-react +
 * setup compartilhado com MSW e matchers do jest-dom). Cada app cria sua config
 * com `createVitestConfig()`, passando overrides de `test` e/ou `resolve`
 * (ex.: o alias `@` → `src`) quando necessário.
 */
export function createVitestConfig(
  overrides: {
    test?: Record<string, unknown>;
    resolve?: Record<string, unknown>;
  } = {},
) {
  return defineConfig({
    plugins: [react()],
    resolve: {
      // Vários pacotes do monorepo (o `next-app-provider`, entre outros) trazem
      // `react` como dependency em vez de peer, então o pnpm dá a cada um a sua
      // cópia — hoje são sete versões instaladas. O bundler do Next junta tudo
      // numa só, mas o Vitest resolve pelo node_modules real: sem isto, o hook
      // que vem de um pacote roda num React diferente do que renderizou o
      // componente, e `useContext` volta null ("Cannot read properties of null").
      dedupe: ['react', 'react-dom'],
      ...overrides.resolve,
    },
    test: {
      // globals: true ativa o auto-cleanup nativo do Testing Library (desmonta o
      // DOM entre testes na instância correta do RTL), evitando vazamento de DOM
      // entre casos.
      globals: true,
      environment: 'jsdom',
      setupFiles: ['@hed-hog/vitest-config/setup'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      ...overrides.test,
    },
  });
}

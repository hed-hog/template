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
    resolve: overrides.resolve,
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

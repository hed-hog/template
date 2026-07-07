import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Base Vitest config for React/Next frontend apps (jsdom + plugin-react +
 * shared setup with MSW and jest-dom matchers). Each app creates its config
 * with `createVitestConfig()`, passing `test` and/or `resolve` overrides
 * (e.g., the `@` → `src` alias) when needed.
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
      // globals: true enables Testing Library's native auto-cleanup (unmounts
      // the DOM between tests on the correct RTL instance), avoiding DOM
      // leakage between cases.
      globals: true,
      environment: 'jsdom',
      setupFiles: ['@hed-hog/vitest-config/setup'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      // Kept well above setup.ts's asyncUtilTimeout so Vitest's own timeout
      // never races Testing Library's — see the comment there for why.
      testTimeout: 15000,
      hookTimeout: 15000,
      ...overrides.test,
    },
  });
}

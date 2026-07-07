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
      // Retry under CI only: real dynamic-import + effect chains (e.g.
      // McpFloatingChat's chat-components loader) can occasionally exceed
      // asyncUtilTimeout under full-suite worker contention with no
      // underlying bug. Retrying masks that infra noise in CI while keeping
      // failures loud (retry: 0) during local dev, where a fail should mean
      // a real regression.
      retry: process.env.CI ? 2 : 0,
      ...overrides.test,
    },
  });
}

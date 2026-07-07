import { createVitestConfig } from '@hed-hog/vitest-config/react';
import { fileURLToPath } from 'node:url';
import { coverageConfigDefaults } from 'vitest/config';

// Shared config (jsdom + plugin-react + MSW + jest-dom). See
// packages/vitest-config. The `@` → src alias mirrors the admin's tsconfig so
// that component tests resolve `@/...` imports.
const src = fileURLToPath(new URL('./src', import.meta.url));

export default createVitestConfig({
  resolve: { alias: { '@': src } },
  test: {
    coverage: {
      // 100% across the board (global aggregate, not perFile). Genuinely
      // unreachable branches are annotated with `/* v8 ignore */` at the
      // source rather than lowering these floors — see git history for the
      // reasoning behind each one.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/types/**',
        'next.config.ts',
        'playwright.config.ts',
        'postcss.config.mjs',
        'e2e/**',
        'src/components/entity-list/index.ts',
        // Re-exports a file under (app)/(libraries)/core/... that is generated later
        // by `hedhog dev create-library`/`assets-to-library` — doesn't exist in a
        // fresh checkout, so this file can't be imported/tested until then.
        'src/components/settings/setting-field.tsx',
        '.next/**',
      ],
    },
  },
});

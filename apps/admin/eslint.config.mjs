import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

import iconButtonNeedsLabel from './eslint-rules/icon-button-needs-label.mjs';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    plugins: {
      'hedhog-admin': {
        rules: { 'icon-button-needs-label': iconButtonNeedsLabel },
      },
    },
    rules: {
      // Padrão de botão do admin: .claude/skills/admin-buttons
      'hedhog-admin/icon-button-needs-label': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Escrito por scripts/generate-icon-subset.mjs.
    'src/generated/**',
  ]),
]);

export default eslintConfig;

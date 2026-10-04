import { defineConfig } from 'vitest/config';

// Contratos são TypeScript puro (sem DOM, sem Nest): ambiente node basta.
export default defineConfig({
  test: {
    environment: 'node',
  },
});

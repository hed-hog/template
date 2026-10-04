import { defineConfig } from 'vitest/config';

// Lógica pura, sem DOM: o mesmo código roda na API, no main e no renderer do
// Electron e no Admin. O ambiente node basta.
export default defineConfig({
  test: {
    environment: 'node',
  },
});

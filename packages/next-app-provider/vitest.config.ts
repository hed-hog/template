import { defineConfig } from 'vitest/config';

// Config própria em vez de `@hed-hog/vitest-config/react`: o que tem teste aqui
// é a política de renovação de sessão, que é função pura. A config compartilhada
// carregaria o plugin-react e o setup do Testing Library sem necessidade.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});

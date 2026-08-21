import { createVitestConfig } from '@hed-hog/vitest-config/react';
import { fileURLToPath } from 'node:url';

// Config compartilhada (jsdom + plugin-react + MSW + jest-dom). Ver
// packages/vitest-config. O alias `@` → src espelha o tsconfig do admin para
// que testes de componente resolvam os imports `@/...`.
const src = fileURLToPath(new URL('./src', import.meta.url));

export default createVitestConfig({
  resolve: { alias: { '@': src } },
  test: {
    coverage: {
      // Pisos logo abaixo do baseline medido (o denominador inclui TODO o src,
      // páginas ainda sem teste incluídas — por isso statements/lines começam
      // baixos). Sobem conforme a cobertura cresce; regressão falha o gate.
      thresholds: { statements: 1, branches: 78, functions: 65, lines: 1 },
    },
  },
});

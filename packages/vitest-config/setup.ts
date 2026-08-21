import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw';

// Setup compartilhado para todos os apps de frontend:
//  - matchers do jest-dom (toBeInTheDocument, etc.)
//  - servidor MSW: intercepta requisições (fetch/XHR) durante os testes
//  - limpeza do DOM e reset de handlers entre testes (isolamento)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

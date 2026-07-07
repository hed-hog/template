import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw';

// Shared setup for all frontend apps:
//  - jest-dom matchers (toBeInTheDocument, etc.)
//  - MSW server: intercepts requests (fetch/XHR) during tests
//  - DOM cleanup and handler reset between tests (isolation)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

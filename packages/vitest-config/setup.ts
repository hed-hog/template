import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './msw';

// Shared setup for all frontend apps:
//  - jest-dom matchers (toBeInTheDocument, etc.)
//  - MSW server: intercepts requests (fetch/XHR) during tests
//  - DOM cleanup and handler reset between tests (isolation)
// asyncUtilTimeout raised from the 1000ms default: on slower/loaded CI
// runners, findBy*/waitFor calls that wait on real timers + dynamic imports
// can exceed 1s with no underlying bug, causing intermittent flakes.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

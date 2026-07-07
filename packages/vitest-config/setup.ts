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
// Keep this comfortably below react.ts's testTimeout/hookTimeout (15000ms) —
// if the two are equal (as they were before), Vitest's own timeout races
// Testing Library's and kills the test with an opaque "timed out" instead of
// RTL's clearer error, which is what caused the flakes this was meant to fix.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

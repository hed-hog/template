import { setupServer } from 'msw/node';

/**
 * Shared MSW server. Tests add per-case handlers via
 * `server.use(http.get(...))`. The lifecycle (listen/resetHandlers/close) is
 * wired up in setup.ts. Re-exported by index.ts so apps don't need to
 * declare `msw` directly.
 */
export const server = setupServer();

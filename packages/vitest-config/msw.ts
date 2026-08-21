import { setupServer } from 'msw/node';

/**
 * Servidor MSW compartilhado. Tests adicionam handlers por caso via
 * `server.use(http.get(...))`. O ciclo de vida (listen/resetHandlers/close) é
 * ligado no setup.ts. Reexportado por index.ts para os apps não precisarem
 * declarar `msw` diretamente.
 */
export const server = setupServer();

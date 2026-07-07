/**
 * Request/response contracts shared between backend and frontend.
 *
 * Unlike the other files in this package (table-row-shaped types generated
 * by database introspection), this submodule is hand-written and describes
 * the API CONTRACTS (response envelopes and error format) using zod, serving
 * as the single source of truth for contract tests on both sides. Re-exported
 * by the main entry point: `import { paginationEnvelope } from '@hed-hog/api-types'`.
 */
export * from './pagination';
export * from './error';

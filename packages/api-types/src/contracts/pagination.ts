import { z } from 'zod';

/**
 * Standard pagination envelope returned by all of the API's listing endpoints.
 * It is the single source of truth for the contract consumed both by the backend
 * (E2E contract tests) and by the frontend hooks (e.g. usePaginationFetch,
 * commerce/_lib/api.ts). Any shape divergence must break the contract tests
 * BEFORE it reaches the apps.
 *
 * @example
 *   const CoursesPage = paginationEnvelope(z.object({ id: z.number(), name: z.string() }));
 *   CoursesPage.parse(await res.json());
 */
export const paginationEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    // Pagination fields are OPTIONAL: the API varies quite a bit (many routes
    // omit prev/next and, in some cases, lastPage/page/pageSize). When
    // present, the TYPE is validated — this way the contract catches real
    // breakages (e.g. `total` becoming a string, `data` no longer being an
    // array) without requiring fields that the API historically doesn't return.
    lastPage: z.number().int().nonnegative().nullable().optional(),
    page: z.number().int().nullable().optional(),
    pageSize: z.number().int().nullable().optional(),
    prev: z.number().int().nullable().optional(),
    next: z.number().int().nullable().optional(),
  });

/**
 * Pagination envelope without validating each item's shape — useful for
 * contract assertions where only the envelope matters.
 */
export const anyPaginationEnvelope = paginationEnvelope(z.unknown());

/** Type inferred from the pagination envelope, for reuse in the frontend/backend. */
export interface PaginationEnvelope<T> {
  data: T[];
  total: number;
  lastPage: number;
  page: number;
  pageSize: number;
  prev: number | null;
  next: number | null;
}

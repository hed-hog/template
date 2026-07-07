import { z } from 'zod';

/**
 * Standard API error format, emitted by the global HttpExceptionFilter
 * (apps/api/src/filters/http-exception.filter.ts). `message` can be:
 *   - a plain string (HttpException with a message)
 *   - an array of strings (non-400 validation errors)
 *   - an object { field: string[] } (normalized 400 validation errors)
 * that's why the field is permissive.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.any()), z.record(z.any())]),
  error: z.string(),
  timestamp: z.string(),
  path: z.string(),
});

/** Type inferred from the API's error envelope. */
export type ApiError = z.infer<typeof apiErrorSchema>;

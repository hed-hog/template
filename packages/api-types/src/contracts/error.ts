import { z } from 'zod';

/**
 * Formato de erro padrão da API, emitido pelo HttpExceptionFilter global
 * (apps/api/src/filters/http-exception.filter.ts). `message` pode ser:
 *   - string simples (HttpException com mensagem)
 *   - array de strings (erros de validação não-400)
 *   - objeto { campo: string[] } (erros de validação 400 normalizados)
 * por isso o campo é permissivo.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.any()), z.record(z.any())]),
  error: z.string(),
  timestamp: z.string(),
  path: z.string(),
});

/** Tipo inferido do envelope de erro da API. */
export type ApiError = z.infer<typeof apiErrorSchema>;

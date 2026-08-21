import { z } from 'zod';

/**
 * Envelope de paginação padrão retornado por todos os endpoints de listagem da
 * API. É a fonte única de verdade do contrato consumido tanto pelo backend
 * (testes de contrato E2E) quanto pelos hooks do frontend (ex.: usePaginationFetch,
 * commerce/_lib/api.ts). Qualquer divergência de shape deve quebrar os testes de
 * contrato ANTES de chegar aos apps.
 *
 * @example
 *   const CoursesPage = paginationEnvelope(z.object({ id: z.number(), name: z.string() }));
 *   CoursesPage.parse(await res.json());
 */
export const paginationEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    // Campos de paginação são OPCIONAIS: a API varia bastante (muitas rotas
    // omitem prev/next e, em alguns casos, lastPage/page/pageSize). Quando
    // presentes, o TIPO é validado — assim o contrato pega quebras reais (ex.:
    // `total` virar string, `data` deixar de ser array) sem impor a presença de
    // campos que a API historicamente não retorna.
    lastPage: z.number().int().nonnegative().nullable().optional(),
    page: z.number().int().nullable().optional(),
    pageSize: z.number().int().nullable().optional(),
    prev: z.number().int().nullable().optional(),
    next: z.number().int().nullable().optional(),
  });

/**
 * Envelope de paginação sem validar o shape de cada item — útil para asserções
 * de contrato onde só o envelope importa.
 */
export const anyPaginationEnvelope = paginationEnvelope(z.unknown());

/** Tipo inferido do envelope de paginação, para reuso no frontend/back. */
export interface PaginationEnvelope<T> {
  data: T[];
  total: number;
  lastPage: number;
  page: number;
  pageSize: number;
  prev: number | null;
  next: number | null;
}

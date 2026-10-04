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

/**
 * Monta o envelope a partir das linhas e do total.
 *
 * Existia em três cópias — `libraries/sac/src/common/pagination.util.ts`,
 * `libraries/inbox/src/common/pagination.util.ts` (byte a byte iguais) e um
 * método privado em `operations.service.ts` — todas para os serviços que
 * paginam por conta própria, sem o `PaginationService`. Fica aqui, ao lado do
 * `PaginationEnvelope<T>` que ele produz.
 *
 * `page` e `pageSize` são saneados porque parte dos chamadores os recebe direto
 * da query string; quem já normalizou antes não perde nada com isso.
 */
export function buildPaginationEnvelope<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginationEnvelope<T> {
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const safePage = Math.max(1, Number(page) || 1);
  const lastPage = Math.max(1, Math.ceil(total / safePageSize));

  return {
    data,
    total,
    page: safePage,
    pageSize: safePageSize,
    lastPage,
    prev: safePage > 1 ? safePage - 1 : null,
    next: safePage < lastPage ? safePage + 1 : null,
  };
}

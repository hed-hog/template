/**
 * O Prisma dimensiona o pool de conexões por `núcleos × 2 + 1` e lê os núcleos do NODE,
 * não do limite de CPU do container. Num node c-8 do pool de vídeo isso dá 17 conexões
 * por pod mesmo com o worker rodando um job por vez; com o KEDA escalando até 8 pods, o
 * total passa do `max_connections` do Postgres e as conversões morrem com
 * "FATAL: sorry, too many clients already" depois de 40+ minutos de trabalho.
 *
 * Não existe env nativa para isso — `connection_limit`/`pool_timeout` só são aceitos como
 * query params da URL do datasource, e a URL vem de um secret compartilhado. Estas funções
 * aplicam os params a partir do ambiente, para cada deployment declarar seu próprio teto
 * sem duplicar o secret. Params já presentes na URL sempre vencem.
 */

const CONNECTION_LIMIT_PARAM = 'connection_limit';
const POOL_TIMEOUT_PARAM = 'pool_timeout';

/**
 * Com o pool limitado, uma rajada de queries (ex.: upload de segmentos HLS em lotes de 20)
 * enfileira em vez de abrir conexão nova. O default do Prisma (10s) derruba a espera cedo
 * demais nesse cenário; 20s cobre a fila sem mascarar um banco realmente travado.
 */
export const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Devolve a URL com `connection_limit`/`pool_timeout` aplicados, ou `undefined` quando não
 * há nada a aplicar (sem `PRISMA_CONNECTION_LIMIT` no ambiente, ou URL ausente) — nesse
 * caso o chamador deve deixar o Prisma resolver o datasource sozinho, como antes.
 *
 * A query string é manipulada por índice em vez de `new URL()` de propósito: a URL carrega
 * credenciais e `URL.toString()` pode reescrever a codificação do userinfo.
 */
export function applyPrismaPoolParams(
  rawUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!rawUrl) return undefined;

  const connectionLimit = parsePositiveInteger(env.PRISMA_CONNECTION_LIMIT);
  if (connectionLimit === undefined) return undefined;

  const queryStart = rawUrl.indexOf('?');
  const base = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
  const params = new URLSearchParams(
    queryStart === -1 ? '' : rawUrl.slice(queryStart + 1),
  );

  if (!params.has(CONNECTION_LIMIT_PARAM)) {
    params.set(CONNECTION_LIMIT_PARAM, String(connectionLimit));
  }

  if (!params.has(POOL_TIMEOUT_PARAM)) {
    const poolTimeout =
      parsePositiveInteger(env.PRISMA_POOL_TIMEOUT) ?? DEFAULT_POOL_TIMEOUT_SECONDS;
    params.set(POOL_TIMEOUT_PARAM, String(poolTimeout));
  }

  const query = params.toString();
  return query.length > 0 ? `${base}?${query}` : base;
}

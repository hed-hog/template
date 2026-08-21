/**
 * Conexão do pool derrubada pelo servidor — o caso que o Prisma não trata sozinho.
 *
 * Quando o Postgres desliga (reinício do pod, `pg_terminate_backend`, failover), ele
 * manda `FATAL: terminating connection due to administrator command` (SQLSTATE 57P01)
 * para cada backend aberto. O pool do Prisma não percebe: as conexões continuam lá,
 * mortas, e a PRÓXIMA query de cada uma falha — inclusive depois de o banco já ter
 * voltado. Sem retry, um reinício de 5s vira erro para o usuário até que todas as
 * conexões obsoletas tenham sido queimadas, uma a uma, por requisições reais.
 *
 * O erro chega como `PrismaClientUnknownRequestError`: não tem `code` (`P####`), só a
 * mensagem com o `ConnectorError` cru dentro. Por isso a detecção é por SQLSTATE
 * extraído do texto, e não por campo — ver `isConnectionDroppedError`.
 *
 * Duas fronteiras conhecidas, ambas por opção:
 *
 * - `$queryRaw`/`$executeRaw` não passam pela extension `$allModels`, então não têm
 *   retry. É o que a readiness (`AppService.checkDatabase`) precisa: ela existe para
 *   dizer se o banco responde AGORA, e uma segunda tentativa escondida mentiria.
 * - Dentro de `$transaction` interativa, a transação morre junto com a conexão. A
 *   segunda tentativa acha a transação perdida e falha também — o request termina em
 *   erro do mesmo jeito, só 200ms mais tarde. Não vale detectar: o contexto de
 *   transação não é exposto ao callback da extension.
 */

/**
 * SQLSTATEs em que o servidor derrubou a conexão ou se recusou a atender: a conexão
 * do pool não serve mais, mas o banco não está necessariamente fora.
 *
 * Fora daqui de propósito: `53300` (too many clients) e `53200` (out of memory) — ali
 * repetir só aumenta a pressão sobre um banco que já está no limite.
 */
const SERVER_DROPPED_SQLSTATES = new Set([
  '57P01', // admin_shutdown — shutdown do servidor ou pg_terminate_backend
  '57P02', // crash_shutdown — outro backend caiu e o servidor derrubou todos
  '57P03', // cannot_connect_now — servidor ainda subindo (recovery de WAL)
  '08006', // connection_failure
  '08003', // connection_does_not_exist
  '08000', // connection_exception
]);

/** Códigos do próprio Prisma para a mesma situação. */
const PRISMA_DROPPED_CODES = new Set([
  'P1017', // "Server has closed the connection."
]);

/**
 * Fallback por texto: MySQL (o `getProvider` do PrismaService também aceita) não usa
 * SQLSTATE nessas mensagens, e há caminhos do engine que devolvem só a frase.
 */
const DROPPED_CONNECTION_MESSAGES = [
  'terminating connection due to administrator command',
  'the database system is shutting down',
  'server closed the connection unexpectedly',
  'Server has gone away', // MySQL 2006
  'Server shutdown in progress', // MySQL 1053
];

/** `ConnectorError(... PostgresError { code: "57P01", ... })` dentro da mensagem. */
const SQLSTATE_IN_MESSAGE = /code:\s*"([0-9A-Za-z]{5})"/g;

/**
 * Só leitura. Uma escrita que falha com conexão derrubada é ambígua — o servidor
 * pode ter efetivado a linha e morrido antes de responder — e repetir um `create`
 * duplicaria o registro. Escrita continua subindo como erro, e o HttpExceptionFilter
 * a devolve como 503 para o cliente decidir se tenta de novo.
 */
const RETRYABLE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Uma única tentativa extra, e curta: a segunda pega uma conexão nova do pool, que é
 * tudo o que falta quando a queda foi só a conexão. Se o banco estiver mesmo fora, a
 * segunda também falha — e insistir mais só somaria latência a um erro garantido,
 * multiplicada por toda requisição em andamento.
 */
export const CONNECTION_RETRY_DELAY_MS = 200;

export type ConnectionRetryOptions = {
  /** Injetável nos testes para não esperar de verdade. */
  sleep?: (ms: number) => Promise<void>;
  /** Chamado antes da segunda tentativa (log/telemetria). */
  onRetry?: (error: unknown) => void;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readErrorCode(error: Record<string, unknown>): string | undefined {
  // `code` vem no PrismaClientKnownRequestError; `errorCode`, no de inicialização.
  if (typeof error.code === 'string') return error.code;
  if (typeof error.errorCode === 'string') return error.errorCode;
  return undefined;
}

/** A conexão usada morreu (ou o servidor recusou atender agora)? */
export function isConnectionDroppedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;

  const code = readErrorCode(err);
  if (code && PRISMA_DROPPED_CODES.has(code)) return true;

  const message = typeof err.message === 'string' ? err.message : '';
  if (!message) return false;

  // `exec` em laço (e não `matchAll`) porque o regex é global e compartilhado:
  // criar um novo a cada chamada mantém o `lastIndex` fora do caminho.
  const matcher = new RegExp(SQLSTATE_IN_MESSAGE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(message)) !== null) {
    if (SERVER_DROPPED_SQLSTATES.has(match[1].toUpperCase())) return true;
  }

  return DROPPED_CONNECTION_MESSAGES.some((text) => message.includes(text));
}

/** A operação pode ser repetida sem risco de efeito colateral duplicado? */
export function isRetryableOperation(operation: string): boolean {
  return RETRYABLE_OPERATIONS.has(operation);
}

/**
 * Roda `run` e, se a conexão tiver morrido no meio de uma leitura, tenta uma vez mais.
 * Qualquer outro erro (ou uma escrita) sobe sem alteração.
 */
export async function withConnectionRetry<T>(
  operation: string,
  run: () => Promise<T>,
  { sleep = defaultSleep, onRetry }: ConnectionRetryOptions = {},
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isRetryableOperation(operation) || !isConnectionDroppedError(error)) {
      throw error;
    }

    onRetry?.(error);
    await sleep(CONNECTION_RETRY_DELAY_MS);

    return run();
  }
}

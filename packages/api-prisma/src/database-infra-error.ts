import { isConnectionDroppedError } from './connection-retry';

/**
 * Classificação de "a falha foi do banco, não do pedido".
 *
 * Vive aqui (e não no filtro HTTP, onde nasceu) porque quem precisa dela não é só
 * o caminho de requisição: os ~21 `@Cron` do projeto e o worker de fila rodam fora
 * de qualquer request e, numa queda do Postgres, todos falham ao mesmo tempo — cada
 * um com o stack do seu próprio método. Sem uma classificação compartilhada, o
 * mesmo incidente aparece como N defeitos diferentes.
 *
 * - `unreachable`: o servidor sumiu (rede, DNS, shutdown, conexão derrubada).
 * - `pool`: o servidor está lá, mas não sobrou conexão para esta chamada.
 *
 * Os dois são temporários e não acionáveis no código que estourou; a distinção
 * existe porque só o primeiro significa que o banco inteiro está fora.
 */
export type DatabaseInfraErrorKind = 'unreachable' | 'pool';

/** Banco inalcançável: rede, DNS, servidor fora, conexão fechada no meio da query. */
const UNREACHABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

/** Pool esgotado — o Prisma desistiu de esperar uma conexão livre. */
const POOL_CODES = new Set(['P2024']);

const UNREACHABLE_MESSAGES = ["Can't reach database server"];

const POOL_MESSAGES = [
  'too many clients',
  'Too many database connections',
  'connection pool',
];

/**
 * Quantos níveis de `cause` percorrer. Um erro do Prisma às vezes chega embrulhado
 * por um serviço intermediário (`new Error('falha ao X', { cause })`), e o teto
 * evita laço infinito em cadeia cíclica.
 */
const MAX_CAUSE_DEPTH = 3;

/**
 * O código é lido por duck-typing — o cliente Prisma vem de `@hed-hog/api-prisma`
 * e importar `PrismaClientKnownRequestError` de `@prisma/client` compila mas quebra
 * em runtime — e de dois campos: uma queda durante a query vem como
 * `PrismaClientKnownRequestError.code`, e uma queda já na conexão vem como
 * `PrismaClientInitializationError.errorCode`.
 */
function readErrorCode(error: Record<string, unknown>): string | undefined {
  if (typeof error.code === 'string') return error.code;
  if (typeof error.errorCode === 'string') return error.errorCode;
  return undefined;
}

function classifyOne(error: unknown): DatabaseInfraErrorKind | null {
  if (!error || typeof error !== 'object') return null;

  const err = error as Record<string, unknown>;

  const code = readErrorCode(err);
  if (code) {
    if (UNREACHABLE_CODES.has(code)) return 'unreachable';
    if (POOL_CODES.has(code)) return 'pool';
  }

  // Conexão derrubada pelo servidor no meio da query (57P01 e afins). Não tem
  // código nenhum a ler: vem como `PrismaClientUnknownRequestError`, com o
  // `ConnectorError` cru na mensagem. Chegar aqui significa que o retry de leitura
  // do `withConnectionRetry` já não deu conta: o banco está mesmo fora.
  if (isConnectionDroppedError(error)) return 'unreachable';

  const message = typeof err.message === 'string' ? err.message : '';
  if (!message) return null;

  // Fallback por mensagem: mantém o comportamento para os casos que chegam sem
  // código (erro cru do driver, engine que só devolve texto).
  if (UNREACHABLE_MESSAGES.some((text) => message.includes(text))) {
    return 'unreachable';
  }
  if (POOL_MESSAGES.some((text) => message.includes(text))) return 'pool';

  return null;
}

/**
 * Devolve o tipo de indisponibilidade do banco, ou `null` quando o erro é
 * qualquer outra coisa (inclusive erros de negócio do Prisma, como P2002/P2003).
 */
export function classifyDatabaseInfraError(
  error: unknown,
): DatabaseInfraErrorKind | null {
  let current = error;

  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth++) {
    const kind = classifyOne(current);
    if (kind) return kind;

    const cause = (current as { cause?: unknown } | null)?.cause;
    if (!cause || cause === current) return null;
    current = cause;
  }

  return null;
}

/** Atalho para quem só precisa do sim/não. */
export function isDatabaseInfraError(error: unknown): boolean {
  return classifyDatabaseInfraError(error) !== null;
}

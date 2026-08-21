import {
  classifyDatabaseInfraError,
  isDatabaseInfraError,
} from './database-infra-error';

/**
 * Mensagem real do Sentry API-X (14/08/2026): o cron `reconcileStuckRuns` do
 * agendador de agentes disparou no minuto em que o `postgresql-hub` estava fora.
 */
function unreachableError(): Error {
  const error = new Error(
    [
      'Invalid `prisma.agent_run.findMany()` invocation:',
      '',
      "Can't reach database server at `postgresql-hub:5432`",
      '',
      'Please make sure your database server is running at `postgresql-hub:5432`.',
    ].join('\n'),
  );
  error.name = 'PrismaClientKnownRequestError';
  (error as any).code = 'P1001';
  return error;
}

describe('classifyDatabaseInfraError', () => {
  it('reconhece o erro que chegou ao Sentry pelo cron do agent', () => {
    expect(classifyDatabaseInfraError(unreachableError())).toBe('unreachable');
  });

  it('reconhece os códigos de banco inalcançável, em code e errorCode', () => {
    for (const code of ['P1001', 'P1002', 'P1008', 'P1017']) {
      expect(classifyDatabaseInfraError({ code, message: '' })).toBe('unreachable');
      expect(classifyDatabaseInfraError({ errorCode: code, message: '' })).toBe(
        'unreachable',
      );
    }
  });

  it('separa pool esgotado de banco fora', () => {
    expect(classifyDatabaseInfraError({ code: 'P2024', message: '' })).toBe('pool');
    expect(
      classifyDatabaseInfraError(new Error('Timed out fetching a new connection from the connection pool')),
    ).toBe('pool');
  });

  it('reconhece conexão derrubada pelo servidor (57P01) sem código nenhum', () => {
    const error = new Error(
      'ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "57P01", message: "terminating connection due to administrator command" }) })',
    );
    error.name = 'PrismaClientUnknownRequestError';
    expect(classifyDatabaseInfraError(error)).toBe('unreachable');
  });

  it('atravessa o cause de um erro embrulhado por serviço intermediário', () => {
    const wrapped = new Error('falha ao reconciliar execuções órfãs', {
      cause: unreachableError(),
    });
    expect(classifyDatabaseInfraError(wrapped)).toBe('unreachable');
  });

  it('não entra em laço com cause cíclico', () => {
    const a: any = new Error('a');
    const b: any = new Error('b');
    a.cause = b;
    b.cause = a;
    expect(classifyDatabaseInfraError(a)).toBeNull();
  });

  it('ignora erro de negócio do Prisma e erro comum', () => {
    expect(classifyDatabaseInfraError({ code: 'P2002', message: 'unique' })).toBeNull();
    expect(classifyDatabaseInfraError({ code: 'P2003', message: 'fk' })).toBeNull();
    expect(classifyDatabaseInfraError(new Error('boom'))).toBeNull();
    expect(classifyDatabaseInfraError(null)).toBeNull();
    expect(classifyDatabaseInfraError('string solta')).toBeNull();
  });

  it('isDatabaseInfraError é o sim/não do mesmo critério', () => {
    expect(isDatabaseInfraError(unreachableError())).toBe(true);
    expect(isDatabaseInfraError(new Error('boom'))).toBe(false);
  });
});

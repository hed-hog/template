import {
  isConnectionDroppedError,
  isRetryableOperation,
  withConnectionRetry,
} from './connection-retry';

/**
 * Mensagem real do Sentry API-9 (14/08/2026): o `postgresql-hub` recebeu um fast
 * shutdown e derrubou as conexões abertas no meio de um `findUnique`.
 */
const ADMIN_SHUTDOWN_MESSAGE = `
Invalid \`prisma.queue_job.findUnique()\` invocation:


Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "57P01", message: "terminating connection due to administrator command", severity: "FATAL", detail: None, column: None, hint: None }), transient: false })
`.trim();

function droppedError(): Error {
  const error = new Error(ADMIN_SHUTDOWN_MESSAGE);
  error.name = 'PrismaClientUnknownRequestError';
  return error;
}

describe('isConnectionDroppedError', () => {
  it('reconhece o 57P01 do erro que chegou ao Sentry', () => {
    expect(isConnectionDroppedError(droppedError())).toBe(true);
  });

  it('reconhece os demais SQLSTATEs de conexão derrubada', () => {
    for (const code of ['57P02', '57P03', '08006', '08003', '08000']) {
      const error = new Error(`PostgresError { code: "${code}", message: "x" }`);
      expect(isConnectionDroppedError(error)).toBe(true);
    }
  });

  it('reconhece o P1017 do próprio Prisma, pelo code e pelo errorCode', () => {
    expect(isConnectionDroppedError({ code: 'P1017', message: '' })).toBe(true);
    expect(isConnectionDroppedError({ errorCode: 'P1017', message: '' })).toBe(
      true,
    );
  });

  it('reconhece pelo texto quando não há SQLSTATE na mensagem', () => {
    expect(
      isConnectionDroppedError(new Error('Error: Server has gone away')),
    ).toBe(true);
  });

  it('ignora erro de pool cheio: repetir só pioraria', () => {
    expect(
      isConnectionDroppedError(
        new Error('PostgresError { code: "53300", message: "too many clients" }'),
      ),
    ).toBe(false);
    expect(isConnectionDroppedError({ code: 'P2024', message: 'pool timeout' })).toBe(
      false,
    );
  });

  it('ignora erro de aplicação', () => {
    expect(
      isConnectionDroppedError({
        code: 'P2002',
        message: 'Unique constraint failed',
      }),
    ).toBe(false);
    expect(isConnectionDroppedError(null)).toBe(false);
    expect(isConnectionDroppedError('57P01')).toBe(false);
  });

  it('não confunde o SQLSTATE com outro número de cinco dígitos na mensagem', () => {
    expect(
      isConnectionDroppedError(
        new Error('PostgresError { code: "23505", message: "duplicate key" }'),
      ),
    ).toBe(false);
  });
});

describe('isRetryableOperation', () => {
  it('aceita leitura', () => {
    for (const operation of [
      'findUnique',
      'findUniqueOrThrow',
      'findFirst',
      'findFirstOrThrow',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
    ]) {
      expect(isRetryableOperation(operation)).toBe(true);
    }
  });

  it('recusa escrita', () => {
    for (const operation of [
      'create',
      'createMany',
      'update',
      'updateMany',
      'upsert',
      'delete',
      'deleteMany',
    ]) {
      expect(isRetryableOperation(operation)).toBe(false);
    }
  });
});

describe('withConnectionRetry', () => {
  const sleep = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    sleep.mockClear();
  });

  it('não repete quando a primeira tentativa dá certo', async () => {
    const run = jest.fn().mockResolvedValue({ id: 1 });

    await expect(withConnectionRetry('findUnique', run, { sleep })).resolves.toEqual({
      id: 1,
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('repete a leitura uma vez e devolve o resultado da segunda', async () => {
    const onRetry = jest.fn();
    const run = jest
      .fn()
      .mockRejectedValueOnce(droppedError())
      .mockResolvedValueOnce({ id: 150935 });

    await expect(
      withConnectionRetry('findUnique', run, { sleep, onRetry }),
    ).resolves.toEqual({ id: 150935 });
    expect(run).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(expect.any(Number));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('desiste depois da segunda falha, sem terceira tentativa', async () => {
    const run = jest.fn().mockRejectedValue(droppedError());

    await expect(withConnectionRetry('findMany', run, { sleep })).rejects.toThrow(
      /57P01/,
    );
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('não repete escrita, nem com a conexão derrubada', async () => {
    const run = jest.fn().mockRejectedValue(droppedError());

    await expect(withConnectionRetry('create', run, { sleep })).rejects.toThrow(
      /57P01/,
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('não repete outro erro de leitura', async () => {
    const run = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

    await expect(withConnectionRetry('findFirst', run, { sleep })).rejects.toThrow(
      'Unique constraint failed',
    );
    expect(run).toHaveBeenCalledTimes(1);
  });
});

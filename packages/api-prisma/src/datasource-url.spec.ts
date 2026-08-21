import { applyPrismaPoolParams, DEFAULT_POOL_TIMEOUT_SECONDS } from './datasource-url';

const BASE_URL = 'postgresql://hub:changeme@db.internal:5432/hub';

describe('applyPrismaPoolParams', () => {
  it('devolve undefined sem PRISMA_CONNECTION_LIMIT (mantém o default do Prisma)', () => {
    expect(applyPrismaPoolParams(BASE_URL, {})).toBeUndefined();
  });

  it('devolve undefined sem URL', () => {
    expect(
      applyPrismaPoolParams(undefined, { PRISMA_CONNECTION_LIMIT: '5' }),
    ).toBeUndefined();
  });

  it('aplica connection_limit e pool_timeout padrão', () => {
    const url = applyPrismaPoolParams(BASE_URL, { PRISMA_CONNECTION_LIMIT: '5' });

    expect(url).toBe(
      `${BASE_URL}?connection_limit=5&pool_timeout=${DEFAULT_POOL_TIMEOUT_SECONDS}`,
    );
  });

  it('preserva os params já existentes na URL', () => {
    const url = applyPrismaPoolParams(`${BASE_URL}?schema=public&sslmode=require`, {
      PRISMA_CONNECTION_LIMIT: '5',
    });

    expect(url).toContain('schema=public');
    expect(url).toContain('sslmode=require');
    expect(url).toContain('connection_limit=5');
  });

  it('não sobrescreve connection_limit/pool_timeout declarados na URL', () => {
    const url = applyPrismaPoolParams(
      `${BASE_URL}?connection_limit=3&pool_timeout=45`,
      { PRISMA_CONNECTION_LIMIT: '5', PRISMA_POOL_TIMEOUT: '99' },
    );

    expect(url).toContain('connection_limit=3');
    expect(url).toContain('pool_timeout=45');
    expect(url).not.toContain('connection_limit=5');
  });

  it('respeita PRISMA_POOL_TIMEOUT', () => {
    const url = applyPrismaPoolParams(BASE_URL, {
      PRISMA_CONNECTION_LIMIT: '5',
      PRISMA_POOL_TIMEOUT: '30',
    });

    expect(url).toContain('pool_timeout=30');
  });

  it('ignora valores inválidos de connection_limit', () => {
    for (const value of ['0', '-1', 'abc', '', '  ', '2.5']) {
      expect(
        applyPrismaPoolParams(BASE_URL, { PRISMA_CONNECTION_LIMIT: value }),
      ).toBeUndefined();
    }
  });

  it('não reescreve as credenciais da URL', () => {
    // `new URL().toString()` recodifica o userinfo; a senha precisa sair byte a byte.
    const withSpecialChars = 'postgresql://hub:p%40ss%3Aword@db.internal:5432/hub';
    const url = applyPrismaPoolParams(withSpecialChars, {
      PRISMA_CONNECTION_LIMIT: '5',
    });

    expect(url?.startsWith(`${withSpecialChars}?`)).toBe(true);
  });
});

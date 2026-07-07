import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  AdminApiError,
  buildAdminApiUrl,
  fetchAdminApiJson,
  getAdminApiBaseUrl,
  isRetryableAdminApiError,
} from './admin-api';

const originalEnv = { ...process.env };

describe('admin-api', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    vi.restoreAllMocks();
  });

  it('usa INTERNAL_API_URL e remove /api final', () => {
    process.env.INTERNAL_API_URL = ' https://internal.example.com/api ';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://public.example.com/api';

    expect(getAdminApiBaseUrl()).toBe('https://internal.example.com');
  });

  it('usa NEXT_PUBLIC_API_BASE_URL absoluto quando INTERNAL_API_URL não existe', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://public.example.com/api';

    expect(getAdminApiBaseUrl()).toBe('https://public.example.com');
  });

  it('ignora NEXT_PUBLIC_API_BASE_URL relativo e usa localhost em teste', () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = '/api';

    expect(getAdminApiBaseUrl()).toBe('http://localhost:3100');
  });

  it('monta URL absoluta a partir do path informado', () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com/api';

    expect(buildAdminApiUrl('/health')).toBe('https://api.example.com/health');
    expect(buildAdminApiUrl('users?page=1')).toBe(
      'https://api.example.com/users?page=1',
    );
  });

  it('fetchAdminApiJson retorna JSON e envia headers/cache padrão', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, name: 'Admin' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminApiJson('/users', { timeoutMs: 0 })).resolves.toEqual({
      ok: true,
      name: 'Admin',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }),
      }),
    );
  });

  it('lança AdminApiError com status/body quando a resposta HTTP falha', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500, statusText: 'Down' })),
    );

    await expect(fetchAdminApiJson('/users', { timeoutMs: 0 })).rejects.toMatchObject({
      name: 'AdminApiError',
      responseBody: 'nope',
      status: 500,
      url: 'https://api.example.com/users',
    });
  });

  it('embrulha erro de rede e marca erros transitórios como retryable', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    const cause = Object.assign(new Error('connect failed'), {
      code: 'ECONNREFUSED',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw cause;
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({
      code: 'ECONNREFUSED',
      url: 'https://api.example.com/users',
    });
    expect(isRetryableAdminApiError(error)).toBe(true);
    expect(isRetryableAdminApiError({ code: 'EACCES' })).toBe(false);
  });

  it('lança erro quando não há INTERNAL_API_URL/NEXT_PUBLIC_API_BASE_URL absoluto em produção', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;

    expect(() => getAdminApiBaseUrl()).toThrow(
      'Admin API URL is not configured for production. Set INTERNAL_API_URL or an absolute NEXT_PUBLIC_API_BASE_URL.',
    );
  });

  it('usa AbortSignal.timeout quando disponível e timeoutMs é informado', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );

    await expect(
      fetchAdminApiJson('/users', { timeoutMs: 5000 }),
    ).resolves.toEqual({ ok: true });
  });

  it('usa fallback com AbortController quando AbortSignal.timeout não está disponível', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    const originalAbortSignal = globalThis.AbortSignal;
    vi.stubGlobal('AbortSignal', function AbortSignalStub() {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );

    try {
      await expect(
        fetchAdminApiJson('/users', { timeoutMs: 50 }),
      ).resolves.toEqual({ ok: true });
    } finally {
      vi.stubGlobal('AbortSignal', originalAbortSignal);
    }
  });

  it('marca erro como retryable quando o código vem de uma causa aninhada', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    const innerCause = Object.assign(new Error('inner'), {
      code: 'ECONNRESET',
    });
    const outerError = new Error('outer', { cause: innerCause });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw outerError;
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(isRetryableAdminApiError(error)).toBe(true);
  });

  it('retorna código indefinido quando o erro não possui código nem causa', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('generic failure');
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(error).toMatchObject({ code: undefined });
    expect(isRetryableAdminApiError(error)).toBe(false);
  });

  it('trata erro do tipo AbortError como timeout retryable', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    const abortError = Object.assign(new Error('was aborted'), {
      name: 'AbortError',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortError;
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(error).toMatchObject({ code: 'ETIMEDOUT' });
    expect(isRetryableAdminApiError(error)).toBe(true);
  });

  it('trata mensagem de timeout sem name específico como timeout retryable', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Request timed out');
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(error).toMatchObject({ code: 'ETIMEDOUT' });
    expect(isRetryableAdminApiError(error)).toBe(true);
  });

  it('embrulha erro não-Error (ex: string lançada) com mensagem padrão', async () => {
    process.env.INTERNAL_API_URL = 'https://api.example.com';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw 'plain string failure';
      }),
    );

    const error = await fetchAdminApiJson('/users', { timeoutMs: 0 }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).message).toContain(
      'Unknown admin API fetch error',
    );
    expect((error as AdminApiError).code).toBeUndefined();
  });
});

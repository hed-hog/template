import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('GET /api/server-info', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna a URL pública normalizada quando NEXT_PUBLIC_API_BASE_URL é absoluta', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', ' https://public.example.com/api/ ');
    vi.stubEnv('INTERNAL_API_URL', '');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'https://public.example.com',
    });
  });

  it('usa a URL interna quando a pública não é absoluta', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/relative/path');
    vi.stubEnv('INTERNAL_API_URL', 'http://internal.local/api');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'http://internal.local',
    });
  });

  it('usa a URL interna quando a pública não está definida', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('INTERNAL_API_URL', 'https://internal.example.com/api');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'https://internal.example.com',
    });
  });

  it('retorna o fallback local quando nenhuma variável é uma URL absoluta', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
    vi.stubEnv('INTERNAL_API_URL', '');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'http://localhost:3100',
    });
  });

  it('retorna o fallback local quando ambas variáveis não são absolutas', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'not-a-url');
    vi.stubEnv('INTERNAL_API_URL', 'also-not-a-url');

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'http://localhost:3100',
    });
  });

  it('retorna o fallback local quando as variáveis de ambiente não estão definidas', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', undefined);
    vi.stubEnv('INTERNAL_API_URL', undefined);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      apiUrl: 'http://localhost:3100',
    });
  });
});

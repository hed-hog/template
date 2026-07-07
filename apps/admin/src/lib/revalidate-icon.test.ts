import { afterEach, describe, expect, it, vi } from 'vitest';

import { revalidateSystemIcon } from './revalidate-icon';

describe('revalidateSystemIcon', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna sucesso quando a API responde ok', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revalidateSystemIcon()).resolves.toEqual({
      success: true,
      message: 'Icon cache cleared successfully',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/revalidate-icon', {
      method: 'POST',
    });
  });

  it('retorna erro com a mensagem da API quando a resposta falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ message: 'cache locked' }, { status: 423 }),
      ),
    );

    await expect(revalidateSystemIcon()).resolves.toEqual({
      success: false,
      message: 'cache locked',
    });
  });

  it('usa mensagem padrão quando a resposta falha sem mensagem', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}, { status: 500 })),
    );

    await expect(revalidateSystemIcon()).resolves.toEqual({
      success: false,
      message: 'Failed to revalidate icon',
    });
  });

  it('retorna erro desconhecido quando fetch rejeita com valor não-Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw 'boom';
      }),
    );

    await expect(revalidateSystemIcon()).resolves.toEqual({
      success: false,
      message: 'Unknown error',
    });
  });
});

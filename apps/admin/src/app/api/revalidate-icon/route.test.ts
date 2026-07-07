import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';

import { POST } from './route';

function buildRequest() {
  return new NextRequest('http://localhost/api/revalidate-icon', {
    method: 'POST',
  });
}

describe('POST /api/revalidate-icon', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revalida os caminhos do ícone e retorna sucesso', async () => {
    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/icon');
    expect(revalidatePath).toHaveBeenCalledWith('/favicon.ico');

    const body = await response.json();
    expect(body.revalidated).toBe(true);
    expect(body.message).toBe('Icon cache cleared successfully');
    expect(typeof body.timestamp).toBe('string');
  });

  it('retorna erro 500 com a mensagem do erro quando revalidatePath lança um Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('cache indisponível');
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      revalidated: false,
      message: 'Failed to clear icon cache',
      error: 'cache indisponível',
    });
  });

  it('retorna erro 500 com mensagem genérica quando o erro lançado não é um Error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw 'falha inesperada';
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      revalidated: false,
      message: 'Failed to clear icon cache',
      error: 'Unknown error',
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

let paramsValue: Record<string, unknown> = { token: 'abc123' };

vi.mock('next/navigation', () => ({
  useParams: () => paramsValue,
}));

import UnsubscribePage from './page';

const API_BASE = '/api';
const url = (token: string) => `${API_BASE}/campaign/unsubscribe/${token}`;

describe('UnsubscribePage', () => {
  beforeEach(() => {
    paramsValue = { token: 'abc123' };
  });

  it('mostra estado invalido quando nao ha token (params.token undefined)', () => {
    paramsValue = { token: undefined };
    render(<UnsubscribePage />);
    expect(
      screen.getByText('Link de descadastro invalido.'),
    ).toBeInTheDocument();
  });

  it('extrai o token quando params.token e um array', async () => {
    paramsValue = { token: ['abc123'] };
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'a@b.com',
          scope: 'category',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByText('Descadastro de campanhas'),
      ).toBeInTheDocument();
    });
  });

  it('mostra sucesso quando ja estava descadastrado (alreadyUnsubscribed true)', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'a@b.com',
          scope: 'category',
          alreadyUnsubscribed: true,
          unsubscribedAt: '2024-01-01',
        }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByText('Voce ja estava descadastrado'),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText('Seu email ja havia sido removido anteriormente.'),
    ).toBeInTheDocument();
  });

  it('mostra estado ready com escopo conhecido (SCOPE_LABELS hit)', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'known@scope.com',
          scope: 'category',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByText('known@scope.com')).toBeInTheDocument();
    });
    // "esta categoria de campanhas" appears in the info box AND in the paragraph.
    const matches = screen.getAllByText(/esta categoria de campanhas/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('mostra estado ready com escopo desconhecido (fallback ?? scope.info box, ?? "nossas campanhas" paragraph)', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'unknown@scope.com',
          scope: 'weird_scope',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByText('unknown@scope.com')).toBeInTheDocument();
    });
    // Info box falls back to the raw scope string.
    expect(screen.getByText('weird_scope')).toBeInTheDocument();
    // Paragraph falls back to the generic "nossas campanhas" text.
    expect(screen.getByText(/nossas campanhas/i)).toBeInTheDocument();
  });

  it('mostra invalid com mensagem do corpo JSON quando GET nao e ok', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({ message: 'Token expirado' }, { status: 400 }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByText('Token expirado')).toBeInTheDocument();
    });
  });

  it('mostra mensagem padrao quando GET nao e ok e res.json() falha', async () => {
    server.use(
      http.get(url('abc123'), () => new HttpResponse('not json', { status: 500 })),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByText('Link invalido ou expirado.'),
      ).toBeInTheDocument();
    });
  });

  it('mostra invalid com a mensagem do Error quando o fetch GET rejeita', async () => {
    server.use(
      http.get(url('abc123'), () => HttpResponse.error()),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByText('Link invalido')).toBeInTheDocument();
    });
  });

  it('confirma descadastro com sucesso ao clicar em Confirmar descadastro', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'confirm@me.com',
          scope: 'campaign',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
      http.post(url('abc123'), () => HttpResponse.json({ ok: true })),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirmar descadastro/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar descadastro/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Descadastro confirmado!')).toBeInTheDocument();
    });
    expect(screen.getByText('confirm@me.com')).toBeInTheDocument();
  });

  it('mostra invalid com mensagem do corpo JSON quando POST nao e ok', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'x@y.com',
          scope: 'campaign',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
      http.post(url('abc123'), () =>
        HttpResponse.json({ message: 'Falha ao confirmar' }, { status: 400 }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirmar descadastro/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar descadastro/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Falha ao confirmar')).toBeInTheDocument();
    });
  });

  it('mostra mensagem padrao quando POST nao e ok e res.json() falha', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'x@y.com',
          scope: 'campaign',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
      http.post(url('abc123'), () => new HttpResponse('not json', { status: 500 })),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirmar descadastro/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar descadastro/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Nao foi possivel confirmar o descadastro.'),
      ).toBeInTheDocument();
    });
  });

  it('mostra mensagem generica quando POST fetch rejeita com valor nao-Error', async () => {
    server.use(
      http.get(url('abc123'), () =>
        HttpResponse.json({
          email: 'x@y.com',
          scope: 'campaign',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
    );

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirmar descadastro/i }),
      ).toBeInTheDocument();
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce('falha nao-Error');

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar descadastro/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Ocorreu um erro inesperado. Tente novamente.'),
      ).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });
});

describe('UnsubscribePage — API_BASE customizado via env var', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    }
    vi.resetModules();
  });

  it('usa NEXT_PUBLIC_API_BASE_URL (com barra final removida) quando definida', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://custom.test/api/';
    vi.resetModules();

    paramsValue = { token: 'abc123' };
    server.use(
      http.get('http://custom.test/api/campaign/unsubscribe/abc123', () =>
        HttpResponse.json({
          email: 'custom@base.com',
          scope: 'campaign',
          alreadyUnsubscribed: false,
          unsubscribedAt: null,
        }),
      ),
    );

    const { default: FreshUnsubscribePage } = await import('./page');

    render(<FreshUnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByText('custom@base.com')).toBeInTheDocument();
    });
  });
});

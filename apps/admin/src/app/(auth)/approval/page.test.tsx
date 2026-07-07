import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

let searchParamsMap: Record<string, string | null> = {};

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamsMap[key] ?? null,
  }),
}));

import ApprovalPage from './page';

const CB_URL = 'http://cb.test/webhook';

describe('ApprovalPage', () => {
  beforeEach(() => {
    searchParamsMap = {};
  });

  it('renderiza estado invalido quando nao ha parametro cb', () => {
    render(<ApprovalPage />);
    expect(screen.getByText('Link invalido')).toBeInTheDocument();
  });

  it('usa titulo padrao quando title nao esta presente', () => {
    searchParamsMap = { cb: CB_URL };
    render(<ApprovalPage />);
    expect(screen.getByText('Solicitacao de aprovacao')).toBeInTheDocument();
  });

  it('usa titulo customizado quando presente', () => {
    searchParamsMap = { cb: CB_URL, title: 'Titulo customizado' };
    render(<ApprovalPage />);
    expect(screen.getByText('Titulo customizado')).toBeInTheDocument();
  });

  it('usa titulo padrao quando title e apenas espacos em branco', () => {
    searchParamsMap = { cb: CB_URL, title: '   ' };
    render(<ApprovalPage />);
    expect(screen.getByText('Solicitacao de aprovacao')).toBeInTheDocument();
  });

  it('aprova com sucesso ao clicar em Aprovar', async () => {
    searchParamsMap = { cb: CB_URL };
    let receivedBody: unknown;
    server.use(
      http.post(CB_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    await waitFor(() => {
      expect(screen.getByText('Aprovado!')).toBeInTheDocument();
    });
    expect(screen.getByText(/A geracao vai continuar/i)).toBeInTheDocument();
    expect(receivedBody).toEqual({ decision: 'approve', note: undefined });
  });

  it('vai para o estado rejecting e volta ao clicar em Voltar', () => {
    searchParamsMap = { cb: CB_URL };
    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Rejeitar/i }));
    expect(
      screen.getByPlaceholderText(/deixe o personagem mais escuro/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
    expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();
  });

  it('rejeita com nota preenchida (note.trim() truthy)', async () => {
    searchParamsMap = { cb: CB_URL };
    let receivedBody: unknown;
    server.use(
      http.post(CB_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Rejeitar/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/deixe o personagem mais escuro/i),
      { target: { value: '  ajuste o fundo  ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeicao/i }));

    await waitFor(() => {
      expect(screen.getByText('Rejeitado — obrigado!')).toBeInTheDocument();
    });
    expect(receivedBody).toEqual({ decision: 'reject', note: 'ajuste o fundo' });
  });

  it('rejeita com nota vazia/whitespace (note.trim() falsy -> undefined)', async () => {
    searchParamsMap = { cb: CB_URL };
    let receivedBody: unknown;
    server.use(
      http.post(CB_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Rejeitar/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/deixe o personagem mais escuro/i),
      { target: { value: '   ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeicao/i }));

    await waitFor(() => {
      expect(screen.getByText('Rejeitado — obrigado!')).toBeInTheDocument();
    });
    expect(receivedBody).toEqual({ decision: 'reject', note: undefined });
  });

  it('mostra mensagem de erro do corpo JSON quando res.ok e falso', async () => {
    searchParamsMap = { cb: CB_URL };
    server.use(
      http.post(CB_URL, () =>
        HttpResponse.json({ message: 'Erro customizado do servidor' }, { status: 400 }),
      ),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    await waitFor(() => {
      expect(screen.getByText('Erro customizado do servidor')).toBeInTheDocument();
    });
  });

  it('usa mensagem padrao quando res.json() falha em resposta de erro', async () => {
    searchParamsMap = { cb: CB_URL };
    server.use(
      http.post(CB_URL, () => new HttpResponse('not json', { status: 500 })),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Nao foi possivel registrar sua resposta.'),
      ).toBeInTheDocument();
    });
  });

  it('mostra mensagem generica quando fetch rejeita com valor nao-Error', async () => {
    searchParamsMap = { cb: CB_URL };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce('falha de rede como string');

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Ocorreu um erro inesperado. Tente novamente.'),
      ).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it('nao envia quando cb se torna ausente antes do clique (guarda !cb em submit)', async () => {
    searchParamsMap = { cb: CB_URL };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { rerender } = render(<ApprovalPage />);
    expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();

    // cb passa a ausente numa nova renderizacao (o estado 'ready' ja definido
    // permanece, mas o closure de submit criado nesta renderizacao captura o
    // novo valor de cb).
    searchParamsMap = {};
    rerender(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it('permite tentar novamente apos erro, voltando ao estado ready', async () => {
    searchParamsMap = { cb: CB_URL };
    server.use(
      http.post(CB_URL, () =>
        HttpResponse.json({ message: 'Falhou' }, { status: 400 }),
      ),
    );

    render(<ApprovalPage />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar/i }));

    await waitFor(() => {
      expect(screen.getByText('Falhou')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();
  });
});

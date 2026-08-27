import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

const appState: Record<string, any> = {};

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { ConfirmEmailPage } from './confirm-email-page';

function resetAppState(overrides: Record<string, any> = {}) {
  Object.assign(appState, {
    request: vi.fn(),
    getErrorMessage: vi.fn((e: any) => e?.message || 'unknown error'),
    ...overrides,
  });
}

describe('ConfirmEmailPage', () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams = new URLSearchParams('token=abc');
    resetAppState();
  });

  it('marca como invalido quando nao ha token', () => {
    searchParams = new URLSearchParams();
    render(<ConfirmEmailPage />);
    expect(screen.getByText('invalidTitle')).toBeInTheDocument();
  });

  it('confirma o e-mail e oferece o login', async () => {
    appState.request = vi.fn().mockResolvedValue({
      data: { confirmed: true, alreadyConfirmed: false, email: 'a@b.c', name: null },
    });
    render(<ConfirmEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('successDescription')).toBeInTheDocument();
    });
    expect(appState.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/auth/confirm-email', data: { token: 'abc' } })
    );
  });

  it('mostra a mensagem do backend quando o link expirou', async () => {
    appState.request = vi
      .fn()
      .mockRejectedValue(new Error('Este link expirou ou ja foi utilizado.'));
    render(<ConfirmEmailPage />);
    await waitFor(() => {
      expect(
        screen.getByText('Este link expirou ou ja foi utilizado.')
      ).toBeInTheDocument();
    });
  });

  /**
   * Regressao: `getErrorMessage` e recriado a cada render do AppProvider. Quando ele
   * estava no array de dependencias do efeito, um re-render antes da resposta rodava
   * o cleanup (desligando os handlers da requisicao em voo) e o guard de "ja pedi"
   * impedia uma segunda chamada -- a tela ficava presa em "checking" para sempre.
   */
  it('conclui mesmo quando o componente re-renderiza antes da resposta', async () => {
    let resolveRequest: (value: any) => void = () => {};
    appState.request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const { rerender } = render(<ConfirmEmailPage />);
    expect(screen.getByText('checking')).toBeInTheDocument();

    // Identidade nova, como acontece a cada render do provider.
    appState.getErrorMessage = vi.fn((e: any) => e?.message || 'unknown error');
    rerender(<ConfirmEmailPage />);

    resolveRequest({
      data: { confirmed: true, alreadyConfirmed: true, email: 'a@b.c', name: null },
    });

    await waitFor(() => {
      expect(screen.getByText('alreadyConfirmedDescription')).toBeInTheDocument();
    });
    expect(appState.request).toHaveBeenCalledTimes(1);
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

const appState: Record<string, any> = {};

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { ForgotPage } from './forgot-page';

function resetAppState(overrides: Record<string, any> = {}) {
  Object.assign(appState, {
    showToastHandler: vi.fn(),
    getErrorMessage: vi.fn((e: any) => e?.message || 'unknown error'),
    forgot: vi.fn(),
    currentLocaleCode: 'en',
    getSettingValue: vi.fn(() => undefined),
    accessToken: '',
    user: null,
    ...overrides,
  });
}

describe('ForgotPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppState();
  });

  it('renderiza o formulário de recuperação de senha', () => {
    render(<ForgotPage />);
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'forgotButton' })).toBeInTheDocument();
  });

  it('mostra erro de validação para email inválido', async () => {
    render(<ForgotPage />);
    fireEvent.click(screen.getByRole('button', { name: 'forgotButton' }));
    await waitFor(() => {
      expect(screen.getByText('emailInvalid')).toBeInTheDocument();
    });
  });

  it('envia o formulário com sucesso e mostra estado de carregamento', async () => {
    let resolveForgot: () => void = () => {};
    appState.forgot = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveForgot = resolve;
        })
    );
    render(<ForgotPage />);
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'forgotButton' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'forgotButtonLoading' })).toBeInTheDocument();
    });
    resolveForgot();
    await waitFor(() => {
      expect(appState.showToastHandler).toHaveBeenCalledWith('success', 'forgotSuccess');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'forgotButton' })).toBeInTheDocument();
    });
  });

  it('mostra erro quando o envio falha', async () => {
    appState.forgot = vi.fn().mockRejectedValue(new Error('Falha ao enviar'));
    render(<ForgotPage />);
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'forgotButton' }));
    await waitFor(() => {
      expect(screen.getByText('Falha ao enviar')).toBeInTheDocument();
    });
    expect(screen.getByText('errorTitle')).toBeInTheDocument();
  });

  it('restaura rascunho salvo do email ao montar', async () => {
    localStorage.setItem(
      'core-forgot-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<ForgotPage />);
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('emailPlaceholder') as HTMLInputElement).value
      ).toBe('draft@example.com');
    });
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument();
  });

  it('exibe o status do rascunho em português quando o locale começa com pt', async () => {
    resetAppState({ currentLocaleCode: 'pt-BR' });
    localStorage.setItem(
      'core-forgot-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<ForgotPage />);
    await waitFor(() => {
      expect(screen.getByText(/Rascunho salvo/)).toBeInTheDocument();
    });
  });

  it('não mostra o status de rascunho quando não há rascunho', () => {
    render(<ForgotPage />);
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  });

  it('não mostra o status de rascunho quando savedAt é uma data inválida', async () => {
    localStorage.setItem(
      'core-forgot-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: 'not-a-date',
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<ForgotPage />);
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('emailPlaceholder') as HTMLInputElement).value
      ).toBe('draft@example.com');
    });
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  });

  it('não restaura nada quando não há um rascunho salvo com email', async () => {
    localStorage.setItem(
      'core-forgot-page-draft',
      JSON.stringify({
        payload: {},
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<ForgotPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
    expect(
      (screen.getByPlaceholderText('emailPlaceholder') as HTMLInputElement).value
    ).toBe('');
  });
});

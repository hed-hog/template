import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

const startAuthentication = vi.fn();
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: (...args: unknown[]) => startAuthentication(...args),
}));

const appState: Record<string, any> = {};

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { LoginPage } from './login-page';

function resetAppState(overrides: Record<string, any> = {}) {
  Object.assign(appState, {
    login: vi.fn(),
    getSettingValue: vi.fn(() => undefined),
    showToastHandler: vi.fn(),
    getErrorMessage: vi.fn((e: any) => e?.message || 'unknown error'),
    getUrlAfterLogin: vi.fn(() => '/'),
    currentLocaleCode: 'en',
    request: vi.fn(),
    setAccessToken: vi.fn(),
    accessToken: '',
    user: null,
    ...overrides,
  });
}

async function fillAndSubmit(email = 'user@example.com', password = 'secret1') {
  fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('passwordPlaceholder'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'loginButton' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    push.mockClear();
    startAuthentication.mockReset();
    localStorage.clear();
    resetAppState();
  });

  it('renderiza o formulário padrão de login', async () => {
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('passwordPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('forgotPassword')).toBeInTheDocument();
  });

  it('mostra erros de validação ao enviar campos inválidos', async () => {
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'loginButton' }));
    await waitFor(() => {
      expect(screen.getByText('emailInvalid')).toBeInTheDocument();
    });
    expect(screen.getByText('passwordMinLength')).toBeInTheDocument();
  });

  it('alterna a visibilidade da senha', async () => {
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('passwordPlaceholder')).toBeInTheDocument()
    );
    const passwordInput = screen.getByPlaceholderText(
      'passwordPlaceholder'
    ) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    fireEvent.click(screen.getByLabelText('showPassword'));
    expect(passwordInput.type).toBe('text');
    fireEvent.click(screen.getByLabelText('hidePassword'));
    expect(passwordInput.type).toBe('password');
  });

  it('faz login com sucesso e navega para a url pós-login (não iniciando com /login)', async () => {
    appState.login = vi.fn().mockResolvedValue({ accessToken: 'tok' });
    appState.getUrlAfterLogin = vi.fn(() => '/dashboard');
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(appState.showToastHandler).toHaveBeenCalledWith('success', 'loginSuccess');
  });

  it('faz login com sucesso e cai no fallback "/" quando a url após login é vazia', async () => {
    appState.login = vi.fn().mockResolvedValue({ accessToken: 'tok' });
    appState.getUrlAfterLogin = vi.fn(() => '');
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('faz login com sucesso e cai no fallback "/" quando a url começa com /login', async () => {
    appState.login = vi.fn().mockResolvedValue({ accessToken: 'tok' });
    appState.getUrlAfterLogin = vi.fn(() => '/login?x=1');
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('redireciona para troca de senha obrigatória quando requiresPasswordReset é true', async () => {
    appState.login = vi
      .fn()
      .mockResolvedValue({ accessToken: 'tok', requiresPasswordReset: true });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/core/account/password?required=1')
    );
  });

  it('redireciona para verificação de email quando requiresEmailVerification é true', async () => {
    appState.login = vi
      .fn()
      .mockResolvedValue({ requiresEmailVerification: true, token: 'verify-tok' });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/email-verification?token=verify-tok')
    );
  });

  it('mostra a tela de webauthn quando requiresMfa e há método webauthn', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }, { type: 'totp' }],
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyPromptTitle')).toBeInTheDocument();
    });
    expect(screen.getByText('otherMfaMethodsButton')).toBeInTheDocument();
  });

  it('mostra a tela de webauthn sem botão de outros métodos quando só há webauthn', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyPromptTitle')).toBeInTheDocument();
    });
    expect(screen.queryByText('otherMfaMethodsButton')).not.toBeInTheDocument();
  });

  it('redireciona para /mfa quando requiresMfa sem webauthn', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'totp' }],
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining('/mfa?token=mfa-tok&methods=')
      );
    });
  });

  it('redireciona para /mfa quando requiresMfa e mfaMethods está ausente', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining('/mfa?token=mfa-tok&methods=')
      );
    });
  });

  it('exibe erro quando login falha', async () => {
    appState.login = vi.fn().mockRejectedValue(new Error('Credenciais inválidas'));
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    });
    expect(screen.getByText('errorTitle')).toBeInTheDocument();
  });

  it('volta para a tela de senha ao clicar em "backToPasswordButton"', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyPromptTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'backToPasswordButton' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'loginButton' })).toBeInTheDocument();
    });
  });

  it('usa outro método de mfa a partir da tela de webauthn', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }, { type: 'email' }],
    });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('otherMfaMethodsButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'otherMfaMethodsButton' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining('/mfa?token=mfa-tok&methods=')
      );
    });
  });

  it('faz login via chave de segurança com sucesso e redireciona', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'abc' } })
      .mockResolvedValueOnce({ data: { accessToken: 'new-tok' } });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    appState.getUrlAfterLogin = vi.fn(() => '/dash');
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /securityKeyButton/ }));
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('new-tok');
    });
    expect(push).toHaveBeenCalledWith('/dash');
  });

  it('redireciona para troca de senha após login via chave de segurança quando requerido', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'abc' } })
      .mockResolvedValueOnce({
        data: { accessToken: 'new-tok', requiresPasswordReset: true },
      });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /securityKeyButton/ }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/core/account/password?required=1')
    );
  });

  it('mostra erro quando geração de opções de webauthn falha (sem data)', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    appState.request = vi.fn().mockResolvedValueOnce({ data: undefined });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /securityKeyButton/ }));
    await waitFor(() => {
      expect(screen.getByText('securityKeyUnavailable')).toBeInTheDocument();
    });
  });

  it('mostra erro quando verificação de webauthn não retorna accessToken', async () => {
    appState.login = vi.fn().mockResolvedValue({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: [{ type: 'webauthn' }],
    });
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'abc' } })
      .mockResolvedValueOnce({ data: {} });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    await fillAndSubmit();
    await waitFor(() => {
      expect(screen.getByText('securityKeyButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /securityKeyButton/ }));
    await waitFor(() => {
      expect(screen.getByText('securityKeyUnavailable')).toBeInTheDocument();
    });
  });

  it('não envia o formulário novamente enquanto uma submissão está em andamento', async () => {
    let resolveLogin: (value: any) => void = () => {};
    appState.login = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    const { container } = render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('passwordPlaceholder'), {
      target: { value: 'secret1' },
    });
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(appState.login).toHaveBeenCalledTimes(1));
    // Second submit while `loading` is true must hit the early-return guard.
    fireEvent.submit(form);
    expect(appState.login).toHaveBeenCalledTimes(1);
    resolveLogin({ accessToken: 'tok' });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it('exibe o formulário de emergência ao clicar 5x no título com shift+alt quando a autenticação por email/senha está desabilitada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'disable-authentication-with-email-and-password' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });

    const title = screen.getByText('title');
    // A click without shift+alt resets the counter (branch coverage).
    fireEvent.click(title);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(title, { shiftKey: true, altKey: true });
    }

    await vi.waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('reinicia a contagem do segredo do título quando a janela de tempo expira', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'disable-authentication-with-email-and-password' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });

    const title = screen.getByText('title');
    fireEvent.click(title, { shiftKey: true, altKey: true });
    vi.advanceTimersByTime(9000);
    fireEvent.click(title, { shiftKey: true, altKey: true });
    // Still shouldn't unlock (counter restarted).
    expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reagenda o auto-hide ao desbloquear o formulário de emergência uma segunda vez', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'disable-authentication-with-email-and-password' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });

    const title = screen.getByText('title');
    const unlock = () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(title, { shiftKey: true, altKey: true });
      }
    };
    unlock();
    await vi.waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
    // Unlocking again while the previous 120s auto-hide timeout is still
    // pending must clear it before scheduling a new one.
    unlock();
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('esconde novamente o formulário de emergência após o timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'disable-authentication-with-email-and-password' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });
    const title = screen.getByText('title');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(title, { shiftKey: true, altKey: true });
    }
    await vi.waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
    vi.advanceTimersByTime(120000);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('limpa o timeout de desbloqueio de emergência ao desmontar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'disable-authentication-with-email-and-password' ? true : undefined
      ),
    });
    const { unmount } = render(<LoginPage />);
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('emailPlaceholder')).not.toBeInTheDocument();
    });
    const title = screen.getByText('title');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(title, { shiftKey: true, altKey: true });
    }
    await vi.waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
    // Unmount while the 120s auto-hide timeout is still pending: the cleanup
    // effect must clearTimeout the ref instead of leaking it.
    unmount();
    vi.useRealTimers();
  });

  it('clique no título sem shift+alt não faz nada quando a autenticação está habilitada', async () => {
    render(<LoginPage />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('title'));
    expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
  });

  it('mostra aviso de manutenção quando maintenance-mode está ativo e permite acessar o login', async () => {
    resetAppState({
      currentLocaleCode: 'en',
      getSettingValue: vi.fn((key: string) =>
        key === 'maintenance-mode-enabled' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText('System under maintenance')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Access login' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
  });

  it('mostra aviso de manutenção em português quando o locale começa com pt', async () => {
    resetAppState({
      currentLocaleCode: 'pt-BR',
      getSettingValue: vi.fn((key: string) =>
        key === 'maintenance-mode-enabled' ? true : undefined
      ),
    });
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText('Sistema em manutenção')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Estamos realizando melhorias no momento para garantir mais estabilidade e desempenho.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Tente novamente em alguns minutos.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acessar login' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('emailPlaceholder')).toBeInTheDocument();
    });
  });

  it('renderiza botões de provedores OAuth habilitados e faz login social', async () => {
    resetAppState({
      getSettingValue: vi.fn((key: string) => {
        if (key === 'oauth-facebook-enabled') return true;
        if (key === 'oauth-google-enabled') return true;
        return undefined;
      }),
    });
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText(/Facebook/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Google/)).toBeInTheDocument();
    const facebookButton = screen.getByText(/Facebook/).closest('button')!;
    fireEvent.click(facebookButton);
    await waitFor(() => {
      expect(screen.getAllByText('loginButtonLoading').length).toBeGreaterThan(0);
    });
  });

  it('restaura rascunho salvo do email ao montar', async () => {
    localStorage.setItem(
      'core-login-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<LoginPage />);
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('emailPlaceholder') as HTMLInputElement).value
      ).toBe('draft@example.com');
    });
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument();
  });

  it('exibe o rascunho em português quando o locale começa com pt', async () => {
    resetAppState({ currentLocaleCode: 'pt-BR' });
    localStorage.setItem(
      'core-login-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: new Date().toISOString(),
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText(/Rascunho salvo/)).toBeInTheDocument();
    });
  });

  it('não mostra o status de rascunho quando savedAt é uma data inválida', async () => {
    localStorage.setItem(
      'core-login-page-draft',
      JSON.stringify({
        payload: { email: 'draft@example.com' },
        savedAt: 'not-a-date',
        version: 1,
        ownerKey: 'anonymous',
      })
    );
    render(<LoginPage />);
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('emailPlaceholder') as HTMLInputElement).value
      ).toBe('draft@example.com');
    });
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  });
});

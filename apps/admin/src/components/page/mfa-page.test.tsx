import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// `t`, `router` and the `searchParams` object are given stable identities
// (created once at module scope) instead of fresh objects/closures per call.
// MfaPage's search-params-parsing effect depends on `[searchParams, router,
// showToastHandler, t]`, and unstable identities there would make it re-run
// (and reset `activeTab`) on every render, breaking tab-switching in tests.
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;
vi.mock('next-intl', () => ({
  useTranslations: () => t,
}));

const push = vi.fn();
const routerMock = { push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
let searchParamsMap: Record<string, string | null> = {};
const searchParamsMock = {
  get: (key: string) => searchParamsMap[key] ?? null,
};
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({
    maxLength,
    children,
    ...field
  }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <input data-testid="otp-input" maxLength={maxLength as number} {...field} />
  ),
  InputOTPGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  InputOTPSlot: () => null,
}));

const startAuthentication = vi.fn();
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: (...args: unknown[]) => startAuthentication(...args),
}));

const appState: Record<string, any> = {};

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { MfaPage } from './mfa-page';

function resetAppState(overrides: Record<string, any> = {}) {
  Object.assign(appState, {
    showToastHandler: vi.fn(),
    setAccessToken: vi.fn(),
    getUrlAfterLogin: vi.fn(() => '/'),
    getSettingValue: vi.fn(() => undefined),
    request: vi.fn(),
    accessToken: '',
    user: null,
    ...overrides,
  });
}

function withMethods(methods: Array<{ type: string }>) {
  return encodeURIComponent(JSON.stringify(methods));
}

// jsdom has no real pointer-event activation, so Radix's Tabs need an
// explicit mousedown+focus+click sequence to switch the active tab
// (see src/components/ui/tabs.test.tsx for the same pattern).
function switchTab(tab: HTMLElement) {
  fireEvent.mouseDown(tab);
  fireEvent.focus(tab);
  fireEvent.click(tab);
}

describe('MfaPage', () => {
  beforeEach(() => {
    push.mockClear();
    startAuthentication.mockReset();
    searchParamsMap = {};
    resetAppState();
  });

  it('redireciona para /login quando não há token', async () => {
    render(<MfaPage />);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/login');
    });
    expect(appState.showToastHandler).toHaveBeenCalledWith(
      'error',
      'errorMfaTokenNotFoundRedirect'
    );
  });

  it('mostra a tela exclusiva de webauthn quando só há esse método', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('descriptionWebAuthnOnly')).toBeInTheDocument();
    });
    expect(screen.getByText('webAuthnClickInstructions')).toBeInTheDocument();
  });

  it('volta para o login a partir da tela exclusiva de webauthn', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonBackToLogin/ }));
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('autentica com sucesso via webauthn (tela exclusiva) e navega para a url pós-login', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'c' } })
      .mockResolvedValueOnce({ data: { accessToken: 'new-tok' } });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    appState.getUrlAfterLogin = vi.fn(() => '/after');
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('new-tok');
    });
    expect(push).toHaveBeenCalledWith('/after');
    expect(appState.showToastHandler).toHaveBeenCalledWith('success', 'successAuth');
  });

  it('não dispara a autenticação webauthn automaticamente sem interação (o timer de auto-start se auto-cancela)', async () => {
    // Documents existing behavior: `shouldAutoStartWebAuthn` is itself a
    // dependency of the effect that schedules the auto-start timer, so
    // flipping it to `false` (to prevent re-scheduling) triggers the effect's
    // own cleanup — which clears that same timer — before it can fire. The
    // 500ms auto-start for an exclusively-WebAuthn MFA flow never runs; the
    // user always has to click the button manually.
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'c' } })
      .mockResolvedValueOnce({ data: { accessToken: 'auto-tok' } });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(appState.request).not.toHaveBeenCalled();
  });

  it('redireciona para troca de senha quando webauthn exige requiresPasswordReset', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'c' } })
      .mockResolvedValueOnce({
        data: { accessToken: 'new-tok', requiresPasswordReset: true },
      });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/core/account/password?required=1')
    );
  });

  it('não navega quando a verificação webauthn não retorna accessToken', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi
      .fn()
      .mockResolvedValueOnce({ data: { challenge: 'c' } })
      .mockResolvedValueOnce({ data: {} });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() => {
      expect(appState.request).toHaveBeenCalledTimes(2);
    });
    expect(push).not.toHaveBeenCalledWith('/after');
    expect(appState.setAccessToken).not.toHaveBeenCalled();
  });

  it('mostra erro quando a geração de opções webauthn falha (sem data)', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi.fn().mockResolvedValueOnce({ data: undefined });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() => {
      expect(screen.getByText('errorWebAuthnFailed')).toBeInTheDocument();
    });
  });

  it('mostra a mensagem de erro customizada do servidor quando webauthn falha', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    appState.request = vi
      .fn()
      .mockRejectedValueOnce({ response: { data: { message: 'Erro do servidor' } } });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() => {
      expect(screen.getByText('Erro do servidor')).toBeInTheDocument();
    });
  });

  it('inicia a autenticação webauthn manualmente via clique no botão', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'webauthn' }]) };
    let resolveRequest: (value: any) => void = () => {};
    appState.request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonUseSecurityKey')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonUseSecurityKey/ }));
    await waitFor(() => expect(appState.request).toHaveBeenCalledTimes(1));
    resolveRequest({ data: { challenge: 'c' } });
  });

  it('mostra layout com abas quando há múltiplos métodos e permite trocar de aba', async () => {
    searchParamsMap = {
      token: 'tok',
      methods: withMethods([{ type: 'totp' }, { type: 'email' }, { type: 'webauthn' }]),
    };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('descriptionMultipleMethods')).toBeInTheDocument();
    });
    expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    switchTab(screen.getByRole('tab', { name: /tabEmail/ }));
    await waitFor(() => expect(screen.getByText('instructionEmail')).toBeInTheDocument());
    switchTab(screen.getByRole('tab', { name: /tabSecurityKey/ }));
    await waitFor(() =>
      expect(screen.getByText('instructionWebAuthn')).toBeInTheDocument()
    );
    switchTab(screen.getByRole('tab', { name: /tabRecoveryCode/ }));
    await waitFor(() =>
      expect(screen.getByText('instructionRecovery')).toBeInTheDocument()
    );
  });

  it('ativa apenas totp quando presente (sem email/webauthn)', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
  });

  it('ativa apenas email quando presente (sem totp/webauthn)', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'email' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionEmail')).toBeInTheDocument();
    });
  });

  it('cai na aba de recuperação quando nenhum método reconhecido está presente', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'unknown' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionRecovery')).toBeInTheDocument();
    });
  });

  it('ignora methods inválido (JSON malformado) sem quebrar', async () => {
    searchParamsMap = { token: 'tok', methods: '%not-json%' };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
    });
  });

  it('trata methods que não é um array de MfaMethod válido', async () => {
    searchParamsMap = { token: 'tok', methods: encodeURIComponent(JSON.stringify(['x', 1])) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionRecovery')).toBeInTheDocument();
    });
  });

  it('verifica o código TOTP com sucesso', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    appState.request = vi.fn().mockResolvedValue({ data: { accessToken: 'tok2' } });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('tok2');
    });
    expect(appState.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/auth/login-code',
        method: 'POST',
        data: { token: 'tok', code: '123456', methodType: 'totp' },
      })
    );
  });

  it('volta para o login a partir do layout com abas', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonBackToLogin/ }));
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('mostra erro de validação quando o código TOTP tem tamanho incorreto', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() => {
      expect(screen.getByText(/errorCodeLength/)).toBeInTheDocument();
    });
  });

  it('verifica o código de email com tamanho customizado via setting', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'email' }]) };
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'mfa-email-code-length' ? '4' : undefined
      ),
      request: vi.fn().mockResolvedValue({ data: { accessToken: 'tok2' } }),
    });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionEmail')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('tok2');
    });
  });

  it('redireciona para troca de senha após verificar código quando requerido', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    appState.request = vi.fn().mockResolvedValue({
      data: { accessToken: 'tok2', requiresPasswordReset: true },
    });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/core/account/password?required=1')
    );
  });

  it('não navega quando a verificação de código não retorna accessToken', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    appState.request = vi.fn().mockResolvedValue({ data: {} });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionTotp')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() => expect(appState.request).toHaveBeenCalledTimes(1));
    expect(appState.setAccessToken).not.toHaveBeenCalled();
  });

  it('verifica código de recuperação com sucesso', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'unknown' }]) };
    appState.request = vi.fn().mockResolvedValue({ data: { accessToken: 'tok2' } });
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('instructionRecovery')).toBeInTheDocument();
    });
    const recoveryInput = screen.getByLabelText('labelRecoveryCode');
    fireEvent.change(recoveryInput, { target: { value: 'RECOVER-1' } });
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('tok2');
    });
    expect(appState.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { token: 'tok', code: 'RECOVER-1', methodType: 'recovery' },
      })
    );
  });

  it('dispara o branch webauthn dentro do onSubmit ao submeter o formulário na aba de chave de segurança', async () => {
    searchParamsMap = {
      token: 'tok',
      methods: withMethods([{ type: 'totp' }, { type: 'webauthn' }]),
    };
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'mfa-email-code-length' ? '0' : undefined
      ),
      request: vi
        .fn()
        .mockResolvedValueOnce({ data: { challenge: 'c' } })
        .mockResolvedValueOnce({ data: { accessToken: 'wa-tok' } }),
    });
    startAuthentication.mockResolvedValue({ id: 'assertion' });
    const { container } = render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /tabSecurityKey/ })).toBeInTheDocument();
    });
    switchTab(screen.getByRole('tab', { name: /tabSecurityKey/ }));
    await waitFor(() => {
      expect(screen.getByText('instructionWebAuthn')).toBeInTheDocument();
    });
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(appState.setAccessToken).toHaveBeenCalledWith('wa-tok');
    });
  });

  it('não reinicia a autenticação webauthn quando já está em andamento (clique seguido de submit)', async () => {
    searchParamsMap = {
      token: 'tok',
      methods: withMethods([{ type: 'totp' }, { type: 'webauthn' }]),
    };
    resetAppState({
      getSettingValue: vi.fn((key: string) =>
        key === 'mfa-email-code-length' ? '0' : undefined
      ),
      // Never resolves: keeps `webAuthnStarted` true for the second call.
      request: vi.fn(() => new Promise(() => {})),
    });
    const { container } = render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /tabSecurityKey/ })).toBeInTheDocument();
    });
    switchTab(screen.getByRole('tab', { name: /tabSecurityKey/ }));
    await waitFor(() => {
      expect(screen.getByText('instructionWebAuthn')).toBeInTheDocument();
    });
    // First call: starts the (never-resolving) webauthn attempt via the
    // button's onClick, committing `webAuthnStarted = true`.
    fireEvent.click(screen.getByRole('button', { name: /buttonVerifying|buttonAuthenticate/ }));
    await waitFor(() => expect(appState.request).toHaveBeenCalledTimes(1));
    expect(screen.getByText('buttonVerifying')).toBeInTheDocument();
    // Second call: submitting the form directly (bypassing the now-disabled
    // button) re-enters onSubmit's webauthn branch, which calls
    // handleWebAuthnAuth again — must be a no-op since it's already started.
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(appState.request).toHaveBeenCalledTimes(1);
  });

  it('mostra erro quando o token de mfa está ausente ao submeter (aba de recuperação sem token)', async () => {
    searchParamsMap = {};
    const { container } = render(<MfaPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    switchTab(screen.getByRole('tab', { name: /tabRecoveryCode/ }));
    await waitFor(() => {
      expect(screen.getByText('instructionRecovery')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('labelRecoveryCode'), {
      target: { value: 'ABC' },
    });
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText('errorMfaTokenNotFound')).toBeInTheDocument();
    });
  });

  it('reenvia o código por email com sucesso e conta a cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'email' }]) };
    appState.request = vi.fn().mockResolvedValue({});
    render(<MfaPage />);
    await vi.waitFor(() => {
      expect(screen.getByText('buttonResendCode')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonResendCode/ }));
    await vi.waitFor(() => {
      expect(screen.getByText(/buttonResendIn/)).toBeInTheDocument();
    });
    expect(appState.showToastHandler).toHaveBeenCalledWith('success', 'successCodeResent');
    // Advance one tick of the cooldown effect (exercises the decrement branch
    // and its clearTimeout cleanup); reaching 0 isn't required for coverage,
    // since the "no cooldown" label is already exercised by the initial render.
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
  });

  it('mostra erro quando o reenvio de código falha', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'email' }]) };
    appState.request = vi.fn().mockRejectedValue(new Error('fail'));
    render(<MfaPage />);
    await waitFor(() => {
      expect(screen.getByText('buttonResendCode')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /buttonResendCode/ }));
    await waitFor(() => {
      expect(appState.showToastHandler).toHaveBeenCalledWith('error', 'errorCodeResend');
    });
  });

  it('extractErrorMessage cai no fallback para diferentes formatos de erro', async () => {
    searchParamsMap = { token: 'tok', methods: withMethods([{ type: 'totp' }]) };
    const errorShapes = [
      new Error('plain'),
      {},
      { response: null },
      { response: { data: null } },
      { response: { data: {} } },
      { response: { data: { message: 42 } } },
    ];
    for (const shape of errorShapes) {
      appState.request = vi.fn().mockRejectedValueOnce(shape);
      const { unmount } = render(<MfaPage />);
      await waitFor(() => {
        expect(screen.getByText('instructionTotp')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: /buttonVerifyCode/ }));
      await waitFor(() => {
        expect(screen.getByText('errorInvalidCode')).toBeInTheDocument();
      });
      unmount();
    }
  });
});

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { navState } = vi.hoisted(() => ({
  navState: {
    push: vi.fn(),
    token: 'tok-abc' as string | null,
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navState.push }),
  useSearchParams: () => ({ get: () => navState.token }),
}));

const { appState } = vi.hoisted(() => ({
  appState: {
    showToastHandler: vi.fn() as ((...args: any[]) => void) | undefined,
    setAccessToken: vi.fn(),
    getUrlAfterLogin: vi.fn(() => '/'),
    getSettingValue: vi.fn(() => null as any),
    request: vi.fn(),
    locales: [] as { code: string; name: string }[],
    currentLocaleCode: 'en',
    setCurrentLocaleCode: vi.fn(),
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

// The real `input-otp` OTPInput relies on DOM measurement APIs unavailable in
// jsdom; replace it with a plain controlled input carrying the same maxLength
// so we can drive the form via fireEvent.change, matching the pattern used in
// src/components/ui/input-otp.test.tsx for lower-level unit tests.
vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({ children, maxLength, ...field }: any) => (
    <input data-testid="otp-code-input" maxLength={maxLength} {...field} />
  ),
  InputOTPGroup: ({ children }: any) => <>{children}</>,
  InputOTPSlot: () => null,
}));

import { EmailVerificationPage } from './email-verification-page';

function fillCode(value: string) {
  fireEvent.change(screen.getByTestId('otp-code-input'), {
    target: { value },
  });
}

function submitForm() {
  fireEvent.click(screen.getByRole('button', { name: 'buttonVerifyEmail' }));
}

describe('EmailVerificationPage', () => {
  beforeEach(() => {
    navState.push.mockClear();
    navState.token = 'tok-abc';
    appState.showToastHandler = vi.fn();
    appState.setAccessToken = vi.fn();
    appState.getUrlAfterLogin = vi.fn(() => '/');
    appState.getSettingValue = vi.fn(() => null);
    appState.request = vi.fn();
    appState.locales = [];
    appState.currentLocaleCode = 'en';
    appState.setCurrentLocaleCode = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redireciona para /login quando não há token na URL', () => {
    navState.token = null;
    render(<EmailVerificationPage />);

    expect(appState.showToastHandler).toHaveBeenCalledWith(
      'error',
      'errorMfaTokenNotFoundRedirect'
    );
    expect(navState.push).toHaveBeenCalledWith('/login');
  });

  it('não quebra quando showToastHandler é indefinido e não há token', () => {
    navState.token = null;
    appState.showToastHandler = undefined;
    render(<EmailVerificationPage />);

    expect(navState.push).toHaveBeenCalledWith('/login');
  });

  it('não redireciona quando há token na URL', () => {
    render(<EmailVerificationPage />);
    expect(navState.push).not.toHaveBeenCalled();
  });

  it('usa 6 como tamanho padrão do código quando a configuração não define um valor', () => {
    render(<EmailVerificationPage />);
    expect(screen.getByTestId('otp-code-input')).toHaveAttribute(
      'maxlength',
      '6'
    );
  });

  it('usa o tamanho de código customizado retornado pela configuração', () => {
    appState.getSettingValue = vi.fn(() => '8');
    render(<EmailVerificationPage />);
    expect(screen.getByTestId('otp-code-input')).toHaveAttribute(
      'maxlength',
      '8'
    );
  });

  it('exibe mensagem de erro ao submeter sem um mfaToken válido', async () => {
    navState.token = null; // effect returns before setMfaToken; mfaToken stays null
    render(<EmailVerificationPage />);
    fillCode('123456');
    submitForm();

    await waitFor(() =>
      expect(screen.getByText('errorMfaTokenNotFound')).toBeInTheDocument()
    );
  });

  it('efetiva a verificação e redireciona para a troca de senha quando exigido', async () => {
    appState.request = vi.fn().mockResolvedValue({
      data: { accessToken: 'access-1', requiresPasswordReset: true },
    });
    render(<EmailVerificationPage />);
    fillCode('123456');
    submitForm();

    await waitFor(() =>
      expect(appState.setAccessToken).toHaveBeenCalledWith('access-1')
    );
    expect(appState.showToastHandler).toHaveBeenCalledWith(
      'success',
      'successEmailVerified'
    );
    expect(navState.push).toHaveBeenCalledWith(
      '/core/account/password?required=1'
    );
  });

  it('efetiva a verificação e redireciona para a URL salva quando não exige troca de senha', async () => {
    appState.getUrlAfterLogin = vi.fn(() => '/dashboard');
    appState.request = vi.fn().mockResolvedValue({
      data: { accessToken: 'access-2', requiresPasswordReset: false },
    });
    render(<EmailVerificationPage />);
    fillCode('123456');
    submitForm();

    await waitFor(() =>
      expect(navState.push).toHaveBeenCalledWith('/dashboard')
    );
  });

  it('redireciona para "/" quando não há URL salva após o login', async () => {
    appState.getUrlAfterLogin = vi.fn(() => '');
    appState.request = vi.fn().mockResolvedValue({
      data: { accessToken: 'access-3', requiresPasswordReset: false },
    });
    render(<EmailVerificationPage />);
    fillCode('123456');
    submitForm();

    await waitFor(() => expect(navState.push).toHaveBeenCalledWith('/'));
  });

  it('não navega quando a resposta não contém accessToken', async () => {
    appState.request = vi.fn().mockResolvedValue({ data: {} });
    render(<EmailVerificationPage />);
    fillCode('123456');
    submitForm();

    await waitFor(() => expect(appState.request).toHaveBeenCalled());
    expect(appState.setAccessToken).not.toHaveBeenCalled();
    expect(navState.push).not.toHaveBeenCalled();
  });

  it('não reenvia o código quando não há mfaToken', () => {
    navState.token = null;
    render(<EmailVerificationPage />);
    fireEvent.click(screen.getByRole('button', { name: 'buttonResendCode' }));

    expect(appState.request).not.toHaveBeenCalled();
  });

  it('reenvia o código com sucesso e inicia a contagem regressiva', async () => {
    let resolveRequest: (value: any) => void = () => {};
    appState.request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    render(<EmailVerificationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'buttonResendCode' }));
    expect(screen.getByText('buttonResending')).toBeInTheDocument();

    await act(async () => {
      resolveRequest({ data: { token: 'new-tok' } });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(appState.showToastHandler).toHaveBeenCalledWith(
        'success',
        'successCodeResent'
      )
    );
    expect(screen.getByText(/buttonResendIn/)).toBeInTheDocument();
  });

  it('decrementa o cooldown de reenvio a cada segundo', async () => {
    vi.useFakeTimers();
    appState.request = vi.fn().mockResolvedValue({ data: { token: 'new-tok' } });
    render(<EmailVerificationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'buttonResendCode' })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/buttonResendIn/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText(/buttonResendIn/)).toBeInTheDocument();
  });

  it('trata falha ao reenviar exibindo mensagem de erro', async () => {
    appState.request = vi.fn().mockRejectedValue(new Error('network'));
    render(<EmailVerificationPage />);

    fireEvent.click(screen.getByRole('button', { name: 'buttonResendCode' }));

    await waitFor(() =>
      expect(appState.showToastHandler).toHaveBeenCalledWith(
        'error',
        'errorCodeResend'
      )
    );
    expect(screen.getByText('buttonResendCode')).toBeInTheDocument();
  });

  it('cancela o timer de cooldown pendente ao desmontar', async () => {
    vi.useFakeTimers();
    appState.request = vi.fn().mockResolvedValue({ data: { token: 'new-tok' } });
    const { unmount } = render(<EmailVerificationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'buttonResendCode' })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(() => unmount()).not.toThrow();
  });

  it('navega de volta para o login ao clicar em "buttonBackToLogin"', () => {
    render(<EmailVerificationPage />);
    fireEvent.click(screen.getByRole('button', { name: 'buttonBackToLogin' }));

    expect(navState.push).toHaveBeenCalledWith('/login');
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

const appState: Record<string, unknown> & {
  request?: ReturnType<typeof vi.fn>;
  refetchUser?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
  getUrlAfterLogin?: ReturnType<typeof vi.fn>;
} = {};

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => appState,
}));

import { ForcePasswordChangePage } from './force-password-change-page';

function resetAppState(overrides: Record<string, unknown> = {}) {
  for (const key of Object.keys(appState)) delete appState[key];
  Object.assign(appState, {
    request: vi.fn().mockResolvedValue({ data: { success: true } }),
    refetchUser: vi.fn().mockResolvedValue(undefined),
    getErrorMessage: vi.fn(
      (e: unknown) => (e as Error | undefined)?.message || 'unknown error'
    ),
    getSettingValue: vi.fn(() => undefined),
    getUrlAfterLogin: vi.fn(() => '/'),
    accessToken: 'tok',
    user: { requires_password_reset: true },
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByPlaceholderText('currentPasswordPlaceholder'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByPlaceholderText('newPasswordPlaceholder'), {
    target: { value: next },
  });
  fireEvent.change(screen.getByPlaceholderText('confirmPasswordPlaceholder'), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole('button', { name: 'submitButton' }));
}

describe('ForcePasswordChangePage', () => {
  beforeEach(() => {
    replace.mockClear();
    resetAppState();
  });

  it('troca a senha, recarrega o usuário e volta para a URL de antes do login', async () => {
    appState.getUrlAfterLogin = vi.fn(() => '/core/dashboard');
    render(<ForcePasswordChangePage />);

    fill('temporaria1', 'NovaSenha#1');

    await waitFor(() =>
      expect(appState.request).toHaveBeenCalledWith({
        url: '/profile/change-password',
        method: 'PUT',
        data: { currentPassword: 'temporaria1', newPassword: 'NovaSenha#1' },
        showErrors: false,
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/core/dashboard'));
    expect(appState.refetchUser).toHaveBeenCalled();
  });

  it('mostra no cartão o erro devolvido pelo backend', async () => {
    appState.request = vi
      .fn()
      .mockRejectedValue(new Error('A senha precisa ter 2 símbolos'));
    render(<ForcePasswordChangePage />);

    fill('temporaria1', 'NovaSenha#1');

    expect(
      await screen.findByText('A senha precisa ter 2 símbolos')
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('recusa nova senha igual à temporária sem chamar a API', async () => {
    render(<ForcePasswordChangePage />);

    fill('temporaria1', 'temporaria1');

    expect(await screen.findByText('samePassword')).toBeInTheDocument();
    expect(appState.request).not.toHaveBeenCalled();
  });

  it('sem sessão manda para o login', () => {
    resetAppState({ accessToken: '', user: null });
    render(<ForcePasswordChangePage />);

    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('sem reset pendente manda para a home', () => {
    resetAppState({ user: { requires_password_reset: false } });
    render(<ForcePasswordChangePage />);

    expect(replace).toHaveBeenCalledWith('/');
  });

  it('não redireciona enquanto o usuário ainda carrega', () => {
    resetAppState({ user: null });
    render(<ForcePasswordChangePage />);

    expect(replace).not.toHaveBeenCalled();
  });

  it('permite sair', () => {
    render(<ForcePasswordChangePage />);

    fireEvent.click(screen.getByRole('button', { name: 'logoutButton' }));

    expect(appState.logout).toHaveBeenCalledTimes(1);
  });
});

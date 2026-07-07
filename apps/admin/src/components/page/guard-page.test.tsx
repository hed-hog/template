import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/test-utils';

// guard-page renders LoginPage/LoadingPage/ForbiddenPage conditionally; those are
// fully covered by their own test files, so here we stub them to focus purely on
// GuardPage's own branching logic (auth/role/password-reset/loading state).
vi.mock('./login-page', () => ({
  LoginPage: () => <div data-testid="login-page-stub" />,
}));
vi.mock('./loading-page', () => ({
  LoadingPage: () => <div data-testid="loading-page-stub" />,
}));
vi.mock('./forbbiden-page', () => ({
  ForbiddenPage: () => <div data-testid="forbidden-page-stub" />,
}));

const { navState } = vi.hoisted(() => ({
  navState: {
    pathname: '/core/dashboard',
    replace: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navState.replace }),
  usePathname: () => navState.pathname,
}));

// useQuery is a plain re-export of @tanstack/react-query's hook, so we keep the
// real implementation (exercised through the shared QueryClientProvider from
// test-utils) and only stub useApp, which is what GuardPage actually depends on
// for auth/roles data.
const { appState } = vi.hoisted(() => ({
  appState: {
    request: vi.fn(),
    accessToken: 'token-123',
    setUrlAfterLogin: vi.fn(),
    user: null as { requires_password_reset?: boolean } | null,
  },
}));
vi.mock('@hed-hog/next-app-provider', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>(
      '@tanstack/react-query'
    );
  return {
    useApp: () => appState,
    useQuery: actual.useQuery,
  };
});

import { GuardPage } from './guard-page';

const CACHE_KEY = 'cached-auth-roles';

function renderGuard(queryClient?: QueryClient) {
  return renderWithProviders(
    <GuardPage>
      <span>conteudo protegido</span>
    </GuardPage>,
    queryClient ? { queryClient } : undefined
  );
}

function fastRetryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
}

describe('GuardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    navState.pathname = '/core/dashboard';
    navState.replace.mockClear();
    appState.request = vi.fn();
    appState.accessToken = 'token-123';
    appState.setUrlAfterLogin = vi.fn();
    appState.user = null;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza LoginPage quando não há accessToken', () => {
    appState.accessToken = '';
    renderGuard();

    expect(screen.getByTestId('login-page-stub')).toBeInTheDocument();
    expect(appState.request).not.toHaveBeenCalled();
  });

  it('renderiza LoadingPage enquanto a requisição de roles está pendente', () => {
    appState.request = vi.fn(() => new Promise(() => {}));
    renderGuard();

    expect(screen.getByTestId('loading-page-stub')).toBeInTheDocument();
  });

  it('renderiza ForbiddenPage quando nenhuma role concede acesso admin', async () => {
    appState.request = vi.fn().mockResolvedValue({
      data: { roles: [{ slug: 'user' }, { slug: undefined }] },
    });
    renderGuard();

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
  });

  it('renderiza os children quando existe role com slug iniciando em "admin"', async () => {
    appState.request = vi.fn().mockResolvedValue({
      data: { roles: [{ slug: 'admin-finance' }] },
    });
    renderGuard();

    await waitFor(() =>
      expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
    );
    // success path also persists the roles to localStorage for offline fallback.
    expect(JSON.parse(localStorage.getItem(CACHE_KEY) as string)).toEqual([
      { slug: 'admin-finance' },
    ]);
  });

  it('trata resposta sem dados como lista de roles vazia', async () => {
    appState.request = vi.fn().mockResolvedValue({});
    renderGuard();

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
  });

  it('usa roles em cache quando offline e a requisição falha', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify([{ slug: 'admin-support' }])
    );
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    appState.request = vi.fn().mockRejectedValue(new Error('offline'));
    renderGuard();

    await waitFor(() =>
      expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
    );
  });

  it('trata cache inválido (JSON quebrado) como lista vazia quando offline', async () => {
    localStorage.setItem(CACHE_KEY, 'not-json{');
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    appState.request = vi.fn().mockRejectedValue(new Error('offline'));
    renderGuard();

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
  });

  it('trata cache não-array como lista vazia quando offline', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ foo: 'bar' }));
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    appState.request = vi.fn().mockRejectedValue(new Error('offline'));
    renderGuard();

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
  });

  it('trata ausência de cache (localStorage vazio) como lista vazia quando offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    appState.request = vi.fn().mockRejectedValue(new Error('offline'));
    renderGuard();

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
  });

  it('não repete a requisição para erros 401 (retry desabilitado)', async () => {
    const requestMock = vi.fn().mockRejectedValue({
      response: { status: 401 },
    });
    appState.request = requestMock;
    renderGuard(fastRetryClient());

    await waitFor(() =>
      expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument()
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('repete a requisição uma vez para erros genéricos antes de desistir', async () => {
    const requestMock = vi.fn().mockRejectedValue(new Error('boom'));
    appState.request = requestMock;
    renderGuard(fastRetryClient());

    await waitFor(
      () =>
        expect(screen.getByTestId('forbidden-page-stub')).toBeInTheDocument(),
      { timeout: 3000 }
    );
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('ignora falhas ao persistir o cache de roles (localStorage.setItem lança)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    appState.request = vi.fn().mockResolvedValue({
      data: { roles: [{ slug: 'admin' }] },
    });
    renderGuard();

    await waitFor(() =>
      expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
    );
  });

  it('informa a pathname atual via setUrlAfterLogin', () => {
    navState.pathname = '/some/route';
    renderGuard();

    expect(appState.setUrlAfterLogin).toHaveBeenCalledWith('/some/route');
  });

  it('redireciona para a rota de redefinição de senha quando requerido', async () => {
    appState.user = { requires_password_reset: true };
    navState.pathname = '/core/dashboard';
    appState.request = vi.fn().mockResolvedValue({
      data: { roles: [{ slug: 'admin' }] },
    });
    const { queryClient } = renderGuard();

    // Ensure the roles query has actually settled (isLoadingRoles -> false) so the
    // render reaches the password-reset branch instead of the "still loading" one
    // (both render the same LoadingPage stub, so this distinguishes them).
    await waitFor(() =>
      expect(
        queryClient.getQueryState(['roles', 'token-123'])?.status
      ).toBe('success')
    );

    await waitFor(() =>
      expect(navState.replace).toHaveBeenCalledWith(
        '/core/account/password?required=1'
      )
    );
    expect(screen.getByTestId('loading-page-stub')).toBeInTheDocument();
  });

  it('não redireciona quando já está na rota de redefinição de senha', async () => {
    appState.user = { requires_password_reset: true };
    navState.pathname = '/core/account/password';
    appState.request = vi.fn().mockResolvedValue({
      data: { roles: [{ slug: 'admin' }] },
    });
    const { queryClient } = renderGuard();

    await waitFor(() =>
      expect(
        queryClient.getQueryState(['roles', 'token-123'])?.status
      ).toBe('success')
    );

    await waitFor(() =>
      expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
    );
    expect(navState.replace).not.toHaveBeenCalled();
  });
});

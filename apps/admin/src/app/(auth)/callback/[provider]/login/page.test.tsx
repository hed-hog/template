import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { appState } = vi.hoisted(() => ({
  appState: {
    request: vi.fn(),
    setAccessToken: vi.fn(),
    getUrlAfterLogin: vi.fn(() => '/'),
    getSettingValue: vi.fn((_key: string) => undefined as unknown),
  },
}));
vi.mock('@hed-hog/next-app-provider', () => ({ useApp: () => appState }));

const { paramsState, searchParamsBox, router } = vi.hoisted(() => ({
  paramsState: { provider: 'google' },
  searchParamsBox: { current: new URLSearchParams('code=abc123') },
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  useParams: () => paramsState,
  useRouter: () => router,
  useSearchParams: () => searchParamsBox.current,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Page from './page';

function setLocation(url: string) {
  const parsed = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      ...parsed,
      href: parsed.href,
      origin: parsed.origin,
      pathname: parsed.pathname,
      search: parsed.search,
      replace: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

describe('Página de callback OAuth — login', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    paramsState.provider = 'google';
    searchParamsBox.current = new URLSearchParams('code=abc123');
    router.push.mockReset();
    router.replace.mockReset();
    appState.request.mockReset();
    appState.setAccessToken.mockReset();
    appState.getUrlAfterLogin.mockReset().mockReturnValue('/');
    appState.getSettingValue.mockReset().mockReturnValue(undefined);
    window.sessionStorage.clear();
    setLocation('http://localhost:3000/callback/google/login?code=abc123');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function setSearchParams(query: string) {
    searchParamsBox.current = new URLSearchParams(query);
  }

  it('retorna null (não renderiza) quando o provider está ausente', () => {
    paramsState.provider = '';
    const { container } = render(<Page />);
    expect(container).toBeEmptyDOMElement();
  });

  it('retorna null (não renderiza) quando o provider é undefined (fallback ?? "")', () => {
    (paramsState as { provider?: string }).provider = undefined;
    const { container } = render(<Page />);
    expect(container).toBeEmptyDOMElement();
  });

  it('usa "github" como translationKey quando o provider normalizado fica vazio (fallback ||)', async () => {
    paramsState.provider = '   ';
    setSearchParams('code=abc123');
    appState.request.mockResolvedValue({ data: {} });
    render(<Page />);
    expect(screen.getByText('loginTitle')).toBeInTheDocument();
    await waitFor(() => expect(appState.request).toHaveBeenCalled());
  });

  it('renderiza o estado de carregamento e troca a URL para remover a query string', async () => {
    setSearchParams('code=abc123');
    appState.request.mockResolvedValue({ data: {} });
    render(<Page />);
    expect(screen.getByText('loginTitle')).toBeInTheDocument();
    await waitFor(() => expect(appState.request).toHaveBeenCalled());
  });

  it('realiza login com sucesso: define o accessToken, mostra toast e navega para a URL pós-login', async () => {
    setSearchParams('code=abc123');
    appState.request.mockResolvedValue({ data: { accessToken: 'tok-1' } });
    appState.getUrlAfterLogin.mockReturnValue('/dashboard');
    render(<Page />);

    await waitFor(() => expect(appState.setAccessToken).toHaveBeenCalledWith('tok-1'));
    expect(router.push).toHaveBeenCalledWith('/dashboard');
  });

  it('navega para "/" quando a URL pós-login começa com "/login"', async () => {
    setSearchParams('code=abc123');
    appState.request.mockResolvedValue({ data: { accessToken: 'tok-1' } });
    appState.getUrlAfterLogin.mockReturnValue('/login/foo');
    render(<Page />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
  });

  it('não navega quando a resposta não contém accessToken', async () => {
    setSearchParams('code=abc123');
    appState.request.mockResolvedValue({ data: {} });
    render(<Page />);

    await waitFor(() => expect(appState.request).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    expect(appState.setAccessToken).not.toHaveBeenCalled();
  });

  it('exibe erro e permite retry (navega para /login) quando o request falha', async () => {
    setSearchParams('code=abc123');
    appState.request.mockRejectedValue({
      response: { data: { message: 'invalid code' } },
    });
    render(<Page />);

    expect(await screen.findByText('invalid code')).toBeInTheDocument();
    screen.getByText('buttonRetry').click();
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('exibe a mensagem "já processado" quando este código já foi tratado nesta sessão', async () => {
    setSearchParams('code=dup-code');
    window.sessionStorage.setItem('oauth-callback:google:login:dup-code', 'processed');
    render(<Page />);

    expect(await screen.findByText('alreadyProcessed')).toBeInTheDocument();
    expect(appState.request).not.toHaveBeenCalled();
  });

  it('encaminha (hub) para outro app quando o state pertence a ele, sem consumir o code localmente', async () => {
    setSearchParams('code=abc123&state=hhweb.training.login.sig');
    appState.getSettingValue.mockReturnValue(['training=https://training.test']);
    render(<Page />);

    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith(
        'https://training.test/callback/google/login?code=abc123&state=hhweb.training.login.sig',
      ),
    );
    expect(appState.request).not.toHaveBeenCalled();
  });

  it('não faz nada quando não há code na URL', () => {
    setSearchParams('');
    render(<Page />);
    expect(appState.request).not.toHaveBeenCalled();
  });
});

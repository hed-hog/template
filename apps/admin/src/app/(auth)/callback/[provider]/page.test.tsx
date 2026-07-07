import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// useApp() mock (mutable per-test via vi.hoisted so it survives module hoisting).
const { appState } = vi.hoisted(() => ({
  appState: { getSettingValue: vi.fn((_key: string) => undefined as unknown) },
}));
vi.mock('@hed-hog/next-app-provider', () => ({ useApp: () => appState }));

const { paramsState } = vi.hoisted(() => ({
  paramsState: { provider: 'google' as string | undefined },
}));
vi.mock('next/navigation', () => ({
  useParams: () => paramsState,
}));

import OAuthCallbackDispatcher from './page';

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

describe('OAuthCallbackDispatcher (hub de encaminhamento)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    paramsState.provider = 'google';
    appState.getSettingValue.mockReset().mockReturnValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('renderiza o indicador de redirecionamento', () => {
    setLocation('http://localhost:3000/callback/google?code=abc');
    render(<OAuthCallbackDispatcher />);
    expect(screen.getByText('Redirecionando…')).toBeInTheDocument();
  });

  it('não redireciona quando o provider é undefined (useParams sem o segmento)', async () => {
    paramsState.provider = undefined;
    setLocation('http://localhost:3000/callback/?code=abc');
    render(<OAuthCallbackDispatcher />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('não redireciona quando o provider está vazio', async () => {
    paramsState.provider = '';
    setLocation('http://localhost:3000/callback/?code=abc');
    render(<OAuthCallbackDispatcher />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('encaminha para a flow local "login" (default) quando não há state', async () => {
    setLocation('http://localhost:3000/callback/google?code=abc');
    render(<OAuthCallbackDispatcher />);
    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith(
        'http://localhost:3000/callback/google/login?code=abc',
      ),
    );
  });

  it('encaminha para a origem resolvida de outro app quando o state aponta para ele', async () => {
    appState.getSettingValue.mockReturnValue(['training=https://training.test']);
    setLocation(
      'http://localhost:3000/callback/google?code=abc&state=hhweb.training.connect.sig',
    );
    render(<OAuthCallbackDispatcher />);
    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith(
        'https://training.test/callback/google/connect?code=abc&state=hhweb.training.connect.sig',
      ),
    );
  });

  it('mantém a origem atual quando o app do state não é resolvido (app-urls sem essa entrada)', async () => {
    appState.getSettingValue.mockReturnValue([]);
    setLocation(
      'http://localhost:3000/callback/google?code=abc&state=hhweb.training.register.sig',
    );
    render(<OAuthCallbackDispatcher />);
    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith(
        'http://localhost:3000/callback/google/register?code=abc&state=hhweb.training.register.sig',
      ),
    );
  });

  it('recorre à origem atual quando o valor resolvido não é uma URL válida', async () => {
    appState.getSettingValue.mockReturnValue(['training=not a valid url']);
    setLocation(
      'http://localhost:3000/callback/google?code=abc&state=hhweb.training.login.sig',
    );
    render(<OAuthCallbackDispatcher />);
    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith(
        'http://localhost:3000/callback/google/login?code=abc&state=hhweb.training.login.sig',
      ),
    );
  });
});

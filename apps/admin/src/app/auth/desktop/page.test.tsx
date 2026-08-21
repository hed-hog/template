import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

let mockAccessToken: string | undefined;
const mockRequest = vi.fn();
const mockSetUrlAfterLogin = vi.fn();

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    accessToken: mockAccessToken,
    request: mockRequest,
    setUrlAfterLogin: mockSetUrlAfterLogin,
  }),
}));

import DesktopAuthPage from './page';

function makeJwt(payload: unknown): string {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('DesktopAuthPage', () => {
  beforeEach(() => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSetUrlAfterLogin.mockClear();
    mockRequest.mockReset();
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: { href: string } }).location = { href: '' };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem accessToken e com provider: mostra spinner e redireciona para a URL de OAuth', () => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams({ provider: 'google', scheme: 'myscheme' });

    const { container } = render(<DesktopAuthPage />);

    expect(mockSetUrlAfterLogin).toHaveBeenCalledWith('/auth/desktop?scheme=myscheme');
    expect(window.location.href).toBe('/api/oauth/google/login');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('authorize')).not.toBeInTheDocument();
  });

  it('sem accessToken e sem provider: redireciona para /login usando o scheme padrão', () => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();

    render(<DesktopAuthPage />);

    expect(mockSetUrlAfterLogin).toHaveBeenCalledWith('/auth/desktop?scheme=hedhog');
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('com accessToken válido: renderiza a UI completa e exibe o e-mail extraído do JWT', () => {
    mockAccessToken = makeJwt({ email: 'user@example.com' });
    mockSearchParams = new URLSearchParams();

    render(<DesktopAuthPage />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('authorize')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('com accessToken malformado: extractEmailFromJwt cai no catch e não exibe e-mail', () => {
    mockAccessToken = 'token-sem-ponto-valido';
    mockSearchParams = new URLSearchParams();

    render(<DesktopAuthPage />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('com accessToken cujo payload tem email não-string: não exibe e-mail', () => {
    mockAccessToken = makeJwt({ email: 12345 });
    mockSearchParams = new URLSearchParams();

    render(<DesktopAuthPage />);

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('ao clicar em autorizar com sucesso: mostra tela de sucesso e navega via window.location.href', async () => {
    mockAccessToken = makeJwt({ email: 'user@example.com' });
    mockSearchParams = new URLSearchParams({ scheme: 'myscheme' });
    mockRequest.mockResolvedValueOnce({
      data: { accessToken: 'at-1', refreshToken: 'rt-1' },
    });

    render(<DesktopAuthPage />);

    fireEvent.click(screen.getByText('authorize'));

    await waitFor(() => {
      expect(screen.getByText('successTitle')).toBeInTheDocument();
    });

    expect(screen.getByText('successMessage')).toBeInTheDocument();
    expect(window.location.href).toBe(
      'myscheme://auth-callback?accessToken=at-1&refreshToken=rt-1',
    );
  });

  it('ao clicar em autorizar com falha: exibe mensagem de erro e reabilita o botão', async () => {
    mockAccessToken = makeJwt({ email: 'user@example.com' });
    mockSearchParams = new URLSearchParams();
    mockRequest.mockRejectedValueOnce(new Error('boom'));

    render(<DesktopAuthPage />);

    const button = screen.getByText('authorize').closest('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    expect(button).not.toBeDisabled();
    expect(screen.queryByText('successTitle')).not.toBeInTheDocument();
  });

  it('não redireciona novamente quando o efeito roda de novo após o primeiro redirecionamento (guard do ref)', () => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();

    const { rerender } = render(<DesktopAuthPage />);

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(mockReplace).toHaveBeenCalledTimes(1);

    mockSearchParams = new URLSearchParams({ provider: 'google' });
    rerender(<DesktopAuthPage />);

    // redirectedRef.current is already true, so the effect body returns early
    // and does not act again despite the new provider param.
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('');
  });

  it('ao clicar em cancelar: navega para /', () => {
    mockAccessToken = makeJwt({ email: 'user@example.com' });
    mockSearchParams = new URLSearchParams();

    render(<DesktopAuthPage />);

    fireEvent.click(screen.getByText('cancel'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

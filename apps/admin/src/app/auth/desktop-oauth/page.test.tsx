import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

let mockAccessToken: string | undefined;
const mockSetUrlAfterLogin = vi.fn();

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    accessToken: mockAccessToken,
    setUrlAfterLogin: mockSetUrlAfterLogin,
  }),
}));

import DesktopOAuthPage from './page';

describe('DesktopOAuthPage', () => {
  beforeEach(() => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSetUrlAfterLogin.mockClear();
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: { href: string } }).location = { href: '' };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redireciona para /auth/desktop com o scheme informado quando já existe accessToken', () => {
    mockAccessToken = 'tok-123';
    mockSearchParams = new URLSearchParams({ scheme: 'myscheme' });

    render(<DesktopOAuthPage />);

    expect(mockReplace).toHaveBeenCalledWith('/auth/desktop?scheme=myscheme');
    expect(window.location.href).toBe('');
  });

  it('usa o scheme padrão "hedhog" quando não informado e há accessToken', () => {
    mockAccessToken = 'tok-123';
    mockSearchParams = new URLSearchParams();

    render(<DesktopOAuthPage />);

    expect(mockReplace).toHaveBeenCalledWith('/auth/desktop?scheme=hedhog');
  });

  it('redireciona para a URL de login OAuth quando não há accessToken mas há provider', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test');
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams({ provider: 'myprovider', scheme: 'myscheme' });

    render(<DesktopOAuthPage />);

    expect(mockSetUrlAfterLogin).toHaveBeenCalledWith('/auth/desktop?scheme=myscheme');
    expect(window.location.href).toBe('http://api.test/oauth/myprovider/login');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('usa string vazia como apiBase quando NEXT_PUBLIC_API_BASE_URL não está definida', () => {
    const original = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams({ provider: 'myprovider' });

    render(<DesktopOAuthPage />);

    expect(window.location.href).toBe('/oauth/myprovider/login');

    if (original !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = original;
  });

  it('não redireciona novamente quando o efeito roda de novo após o primeiro redirecionamento (guard do ref)', () => {
    mockAccessToken = 'tok-123';
    mockSearchParams = new URLSearchParams({ scheme: 'first' });

    const { rerender } = render(<DesktopOAuthPage />);

    expect(mockReplace).toHaveBeenCalledWith('/auth/desktop?scheme=first');
    expect(mockReplace).toHaveBeenCalledTimes(1);

    mockSearchParams = new URLSearchParams({ scheme: 'second' });
    rerender(<DesktopOAuthPage />);

    // redirectedRef.current is already true, so the effect body returns early
    // and does not call router.replace again with the new scheme.
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('redireciona para /login quando não há accessToken nem provider', () => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();

    render(<DesktopOAuthPage />);

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(window.location.href).toBe('');
  });

  it('renderiza o spinner de carregamento', () => {
    mockAccessToken = undefined;
    mockSearchParams = new URLSearchParams();

    const { container } = render(<DesktopOAuthPage />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

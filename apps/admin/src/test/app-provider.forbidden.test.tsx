import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// The provider imports Next deps that don't exist in the test environment; we mock them.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: ReactNode }) => children,
}));

import {
  AppProvider,
  useApp,
  QueryClient,
  LocalStorageKeys,
} from '@hed-hog/next-app-provider';

const API = 'http://api.test';
const toastStub = Object.assign(() => {}, {
  error: () => {},
  success: () => {},
  warning: () => {},
  info: () => {},
});

function makeWrapper(onError?: (error: any, ctx: any) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        toast={toastStub as never}
        settings={{ 'api-base-url': API }}
        locales={[]}
        queryClient={client}
        onError={onError}
      >
        {children}
      </AppProvider>
    );
  };
}

describe('AppProvider — 403 e falha de refresh (integração)', () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
    // usehooks-ts (useLocalStorage) serializes with JSON.stringify.
    localStorage.setItem(LocalStorageKeys.AccessToken, JSON.stringify('tok-123'));
    localStorage.setItem(LocalStorageKeys.RefreshToken, JSON.stringify('rt-123'));
    // /auth/verify fires on mount (enabled: !!accessToken).
    server.use(
      http.get(`${API}/auth/verify`, () => HttpResponse.json({ id: 7, name: 'Root' })),
    );
  });

  it('em 403 sinaliza forbiddenError e dispara onError', async () => {
    const onError = vi.fn();
    server.use(
      http.get(
        `${API}/protected`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper(onError) });

    await act(async () => {
      await result.current
        .request({ url: '/protected', method: 'GET' })
        .catch(() => {});
    });

    expect(result.current.forbiddenError.show).toBe(true);
    expect(result.current.forbiddenError.statusCode).toBe(403);
    expect(onError).toHaveBeenCalled();
    const ctx = onError.mock.calls[0]?.[1];
    expect(ctx.statusCode).toBe(403);
    // 403 must not tear down the session.
    expect(push).not.toHaveBeenCalledWith('/login');
  });

  it('quando o refresh falha, faz logout no servidor e redireciona para /login', async () => {
    let logoutCalled = false;
    server.use(
      http.post(
        `${API}/auth/refresh`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'invalid refresh token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
      http.post(`${API}/auth/logout`, () => {
        logoutCalled = true;
        return HttpResponse.json({ ok: true });
      }),
      http.get(
        `${API}/protected`,
        () =>
          new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current
        .request({ url: '/protected', method: 'GET' })
        .catch(() => {});
    });

    expect(logoutCalled).toBe(true);
    expect(push).toHaveBeenCalledWith('/login');
  });
});

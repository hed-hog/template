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

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        toast={toastStub as never}
        settings={{ 'api-base-url': API }}
        locales={[]}
        queryClient={client}
      >
        {children}
      </AppProvider>
    );
  };
}

describe('AppProvider — interceptors de request (integração)', () => {
  beforeEach(() => {
    localStorage.clear();
    // usehooks-ts (useLocalStorage) serializes with JSON.stringify.
    localStorage.setItem(LocalStorageKeys.AccessToken, JSON.stringify('tok-123'));
    localStorage.setItem(LocalStorageKeys.RefreshToken, JSON.stringify('rt-123'));
    // /auth/verify fires on mount (enabled: !!accessToken).
    server.use(
      http.get(`${API}/auth/verify`, () => HttpResponse.json({ id: 7, name: 'Root' })),
    );
  });

  it('injeta Authorization e Accept-Language nas requisições', async () => {
    let seen: { auth: string | null; lang: string | null } | null = null;
    server.use(
      http.get(`${API}/user`, ({ request }) => {
        seen = {
          auth: request.headers.get('authorization'),
          lang: request.headers.get('accept-language'),
        };
        return HttpResponse.json({
          data: [],
          total: 0,
          lastPage: 0,
          page: 1,
          pageSize: 10,
          prev: null,
          next: null,
        });
      }),
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.request({ url: '/user', method: 'GET' });
    });

    expect(seen!.auth).toBe('Bearer tok-123');
    expect(seen!.lang).toBeTruthy();
  });

  it('em 401 faz refresh via /auth/refresh e repete a requisição com o novo token', async () => {
    let calls = 0;
    let secondAuth: string | null = null;
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'new-token', refreshToken: 'new-rt' }),
      ),
      http.get(`${API}/protected`, ({ request }) => {
        calls++;
        if (calls === 1) {
          return new HttpResponse(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        secondAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    let res: unknown;
    await act(async () => {
      res = await result.current.request({ url: '/protected', method: 'GET' });
    });

    expect(calls).toBe(2);
    expect(secondAuth).toBe('Bearer new-token');
    expect((res as { data: unknown }).data).toEqual({ ok: true });
  });
});

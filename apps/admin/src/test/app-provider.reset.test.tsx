import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// The provider imports Next deps that don't exist in the test environment; we mock them.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: ReactNode }) => children,
}));

import { AppProvider, useApp, QueryClient } from '@hed-hog/next-app-provider';

const API = 'http://api.test';
const toastStub = Object.assign(() => {}, {
  error: () => {},
  success: () => {},
  warning: () => {},
  info: () => {},
});

// JWT valid enough for parseToken() (3 segments, base64url JSON payload).
function makeJwt(payload: Record<string, unknown>) {
  const seg = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${seg({ alg: 'HS256', typ: 'JWT' })}.${seg(payload)}.sig`;
}

function makeWrapper(settings: Record<string, unknown> = { 'api-base-url': API }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider
        toast={toastStub as never}
        settings={settings as Record<string, unknown> as never}
        locales={[]}
        queryClient={client}
      >
        {children}
      </AppProvider>
    );
  };
}

const token = makeJwt({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 });

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  // setAccessToken fires /auth/verify in the mount effect.
  server.use(
    http.get(`${API}/auth/verify`, () =>
      HttpResponse.json({ id: 1, name: 'Root' })
    )
  );
});

describe('AppProvider — resetPassword', () => {
  it('senhas divergentes lançam antes de qualquer request', async () => {
    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(
        result.current.resetPassword('cod', 'nova123', 'diferente')
      ).rejects.toThrow('Passwords do not match');
    });
  });

  it('usa /auth/forgot-reset e persiste o accessToken retornado', async () => {
    server.use(
      http.post(`${API}/auth/forgot-reset`, () =>
        HttpResponse.json({ accessToken: token, refreshToken: 'rt' })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.resetPassword('cod', 'nova123', 'nova123');
    });

    expect(result.current.accessToken).toBe(token);
  });

  it('faz fallback para /auth/reset quando forgot-reset responde 404', async () => {
    let resetCalled = false;
    server.use(
      http.post(`${API}/auth/forgot-reset`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 })
      ),
      http.post(`${API}/auth/reset`, () => {
        resetCalled = true;
        return HttpResponse.json({ accessToken: token, refreshToken: 'rt' });
      })
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.resetPassword('cod', 'nova123', 'nova123');
    });

    expect(resetCalled).toBe(true);
    expect(result.current.accessToken).toBe(token);
  });

  it('erro não-404 no forgot-reset é propagado sem tentar o fallback', async () => {
    server.use(
      http.post(`${API}/auth/forgot-reset`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(
        result.current.resetPassword('cod', 'nova123', 'nova123')
      ).rejects.toBeTruthy();
    });
  });
});

describe('AppProvider — forgot', () => {
  it('dispara POST /auth/forgot e resolve sem valor', async () => {
    let sentEmail: string | undefined;
    server.use(
      http.post(`${API}/auth/forgot`, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        sentEmail = body.email;
        return HttpResponse.json({ ok: true });
      })
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(result.current.forgot('a@b.com')).resolves.toBeUndefined();
    });

    expect(sentEmail).toBe('a@b.com');
  });
});

describe('AppProvider — signup', () => {
  const form = {
    name: 'Fulano',
    email: 'a@b.com',
    password: 'pw123456',
    cpf: '00000000000',
  };

  it('retorna hasChallenge quando o backend exige desafio', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json({ user: { id: 1 }, hasChallenge: true })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    let res: any;
    await act(async () => {
      res = await result.current.signup(form);
    });

    expect(res).toEqual({ accessToken: '', hasChallenge: true });
  });

  it('sem desafio persiste o accessToken e retorna hasChallenge false', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json({
          user: { id: 1 },
          hasChallenge: false,
          accessToken: token,
          refreshToken: 'rt',
        })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    let res: any;
    await act(async () => {
      res = await result.current.signup(form);
    });

    expect(res).toEqual({ accessToken: token, hasChallenge: false });
    expect(result.current.accessToken).toBe(token);
  });

  it('resposta sem user lança "Signup failed"', async () => {
    server.use(
      http.post(`${API}/auth/signup`, () =>
        HttpResponse.json({ hasChallenge: false })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });

    await act(async () => {
      await expect(result.current.signup(form)).rejects.toThrow('Signup failed');
    });
  });
});

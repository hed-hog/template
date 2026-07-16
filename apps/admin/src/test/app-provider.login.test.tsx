import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { http, HttpResponse, server } from '@hed-hog/vitest-config';

// O provider importa deps de Next inexistentes no ambiente de teste; mockamos.
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

// JWT válido o suficiente para parseToken() (3 segmentos, payload JSON base64url).
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

describe('AppProvider — login (ramos de desafio)', () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
    // Caso o login defina accessToken, /auth/verify dispara no mount.
    server.use(
      http.get(`${API}/auth/verify`, () =>
        HttpResponse.json({ id: 1, name: 'Root' })
      )
    );
  });

  it('propaga requiresEmailVerification sem definir tokens', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ requiresEmailVerification: true, token: 'verify-tok' })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    let res: any;
    await act(async () => {
      res = await result.current.login('a@b.com', 'pw');
    });

    expect(res).toEqual({ requiresEmailVerification: true, token: 'verify-tok' });
  });

  it('propaga requiresMfa com mfaToken e métodos', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          requiresMfa: true,
          mfaToken: 'mfa-tok',
          mfaMethods: ['totp'],
        })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    let res: any;
    await act(async () => {
      res = await result.current.login('a@b.com', 'pw');
    });

    expect(res).toEqual({
      requiresMfa: true,
      mfaToken: 'mfa-tok',
      mfaMethods: ['totp'],
    });
  });

  it('quando hasMfa retorna accessToken sem persistir sessão', async () => {
    const token = makeJwt({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 });
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ accessToken: token, hasMfa: true })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    let res: any;
    await act(async () => {
      res = await result.current.login('a@b.com', 'pw');
    });

    expect(res).toEqual({ accessToken: token, hasMfa: true });
  });

  it('login bem-sucedido sinaliza requiresPasswordReset', async () => {
    const token = makeJwt({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 });
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          accessToken: token,
          refreshToken: 'rt',
          requiresPasswordReset: true,
        })
      )
    );

    const { result } = renderHook(() => useApp(), { wrapper: makeWrapper() });
    let res: any;
    await act(async () => {
      res = await result.current.login('a@b.com', 'pw');
    });

    expect(res).toMatchObject({
      accessToken: token,
      hasMfa: false,
      requiresPasswordReset: true,
    });
  });
});

describe('AppProvider — getSettingValue / setSettingValue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getSettingValue lê chave existente e devolve null para ausente', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: makeWrapper({ 'api-base-url': API, 'system-name': 'HedHog' }),
    });

    expect(result.current.getSettingValue('system-name')).toBe('HedHog');
    expect(result.current.getSettingValue('nao-existe')).toBeNull();
  });

  it('setSettingValue persiste chave comum no estado local', async () => {
    server.use(
      http.put(`${API}/setting/system-name`, () =>
        HttpResponse.json({ ok: true })
      )
    );

    const { result } = renderHook(() => useApp(), {
      wrapper: makeWrapper({ 'api-base-url': API, 'system-name': 'Velho' }),
    });

    await act(async () => {
      await result.current.setSettingValue('system-name', 'Novo');
    });

    expect(result.current.getSettingValue('system-name')).toBe('Novo');
  });

  it('setSettingValue remove chaves sensíveis do estado local', async () => {
    server.use(
      http.put(`${API}/setting/ai-openai-api-key`, () =>
        HttpResponse.json({ ok: true })
      )
    );

    const { result } = renderHook(() => useApp(), {
      wrapper: makeWrapper({
        'api-base-url': API,
        'ai-openai-api-key': 'sk-inicial',
      }),
    });

    // Antes: valor presente no estado.
    expect(result.current.getSettingValue('ai-openai-api-key')).toBe('sk-inicial');

    await act(async () => {
      await result.current.setSettingValue('ai-openai-api-key', 'sk-novo');
    });

    // Depois: chave sensível removida (não fica em memória do client).
    expect(result.current.getSettingValue('ai-openai-api-key')).toBeNull();
  });
});

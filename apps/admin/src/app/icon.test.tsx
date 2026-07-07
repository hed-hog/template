import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchAdminApiJson = vi.fn();
const buildAdminApiUrl = vi.fn((path: string) => `http://api.test${path}`);

vi.mock('@/lib/admin-api', () => ({
  fetchAdminApiJson: (...args: unknown[]) => fetchAdminApiJson(...args),
  buildAdminApiUrl: (...args: unknown[]) => buildAdminApiUrl(...args),
}));

vi.mock('next/og', () => ({
  ImageResponse: vi.fn().mockImplementation((el, opts) => ({
    __isImageResponse: true,
    el,
    opts,
  })),
}));

import Icon from './icon';

describe('Icon (dynamic favicon route)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Note: intentionally not calling vi.restoreAllMocks() here — it would
    // strip the mockImplementation off the module-level `ImageResponse` mock
    // (set once in vi.mock('next/og', ...) above), turning subsequent
    // `new ImageResponse(...)` calls into bare/empty instances instead of
    // the fake response object the tests assert on. `vi.clearAllMocks()` in
    // `beforeEach` already resets call history for every mock/spy.
  });

  it('busca ícone de URL absoluta (http/https) com sucesso e retorna Response com buffer', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': 'https://cdn.example.com/icon.png' },
    });

    const buffer = new ArrayBuffer(4);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
      headers: { get: () => 'image/png' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await Icon({});

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.example.com/icon.png',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Content-Type')).toBe(
      'image/png'
    );
  });

  it('URL absoluta com sucesso mas sem content-type -> usa fallback image/png no header', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': 'https://cdn.example.com/no-content-type.png' },
    });

    const buffer = new ArrayBuffer(4);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await Icon({});

    expect((response as Response).headers.get('Content-Type')).toBe(
      'image/png'
    );
  });

  it('URL absoluta com falha na resposta (!ok) lança e cai no catch externo -> fallback', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': 'http://cdn.example.com/icon.png' },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = (await Icon({})) as { __isImageResponse: boolean };

    expect(response.__isImageResponse).toBe(true);
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Error loading dynamic icon:',
      expect.any(Error)
    );
  });

  it('URL relativa (prefixo /) busca via buildAdminApiUrl com sucesso', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': '/uploads/icon.png' },
    });

    const buffer = new ArrayBuffer(8);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
      headers: { get: () => 'image/svg+xml' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await Icon({});

    expect(buildAdminApiUrl).toHaveBeenCalledWith('/uploads/icon.png');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/uploads/icon.png',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Content-Type')).toBe(
      'image/svg+xml'
    );
  });

  it('URL relativa com sucesso mas sem content-type -> usa fallback image/png no header', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': '/uploads/no-content-type.png' },
    });

    const buffer = new ArrayBuffer(8);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buffer,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await Icon({});

    expect((response as Response).headers.get('Content-Type')).toBe(
      'image/png'
    );
  });

  it('URL relativa com falha (!ok) retorna renderFallbackIcon diretamente (sem passar pelo catch)', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({
      setting: { 'icon-url': '/uploads/missing.png' },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = (await Icon({})) as { __isImageResponse: boolean };

    expect(response.__isImageResponse).toBe(true);
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('sem icon-url definido cai para renderFallbackIcon', async () => {
    fetchAdminApiJson.mockResolvedValueOnce({ setting: {} });

    const response = (await Icon({})) as { __isImageResponse: boolean };

    expect(response.__isImageResponse).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('fetchAdminApiJson lança erro -> catch externo -> fallback', async () => {
    fetchAdminApiJson.mockRejectedValueOnce(new Error('network down'));

    const response = (await Icon({})) as { __isImageResponse: boolean };

    expect(response.__isImageResponse).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      'Error loading dynamic icon:',
      expect.any(Error)
    );
  });
});

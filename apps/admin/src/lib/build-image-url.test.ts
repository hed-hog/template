import { describe, it, expect, afterEach, vi } from 'vitest';

// `apiBaseUrl` is resolved at module load time from
// NEXT_PUBLIC_API_BASE_URL; that's why we set the env BEFORE the dynamic
// import and reset modules between cases.
async function loadWithBase(base: string) {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', base);
  vi.resetModules();
  return import('./build-image-url');
}

describe('buildImageUrl / buildFileOpenUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sem base configurada retorna null', async () => {
    const { buildImageUrl, buildFileOpenUrl } = await loadWithBase('');
    expect(buildImageUrl(5)).toBeNull();
    expect(buildFileOpenUrl(5)).toBeNull();
  });

  it('id ausente/zero retorna null mesmo com base', async () => {
    const { buildImageUrl, buildFileOpenUrl } = await loadWithBase(
      'http://api.test'
    );
    expect(buildImageUrl(0)).toBeNull();
    expect(buildImageUrl(null)).toBeNull();
    expect(buildImageUrl(undefined)).toBeNull();
    expect(buildFileOpenUrl(0)).toBeNull();
  });

  it('monta a URL do endpoint de imagem (long-cache)', async () => {
    const { buildImageUrl } = await loadWithBase('http://api.test');
    expect(buildImageUrl(42)).toBe('http://api.test/file/image/42');
  });

  it('monta a URL do endpoint genérico de arquivo', async () => {
    const { buildFileOpenUrl } = await loadWithBase('http://api.test');
    expect(buildFileOpenUrl(42)).toBe('http://api.test/file/open/42');
  });

  it('remove a barra final da base', async () => {
    const { buildImageUrl } = await loadWithBase('http://api.test/');
    expect(buildImageUrl(1)).toBe('http://api.test/file/image/1');
  });
});

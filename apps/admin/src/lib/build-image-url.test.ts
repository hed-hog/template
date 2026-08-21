import { describe, it, expect, afterEach, vi } from 'vitest';

// `apiBaseUrl` é resolvido na carga do módulo a partir de
// NEXT_PUBLIC_API_BASE_URL; por isso configuramos o env ANTES do import
// dinâmico e resetamos os módulos entre os casos.
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

describe('buildAbsoluteImageUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('mantem a URL quando a base ja e absoluta', async () => {
    const { buildAbsoluteImageUrl } = await loadWithBase('http://api.test');
    expect(buildAbsoluteImageUrl(42)).toBe('http://api.test/file/image/42');
  });

  it('qualifica a base relativa `/api` contra a origem da pagina', async () => {
    // Em producao NEXT_PUBLIC_API_BASE_URL costuma ser `/api` (rewrite do
    // Next). O valor gravado na setting precisa ser absoluto porque tambem e
    // lido fora do browser - pelo e-mail transacional, por exemplo.
    const { buildAbsoluteImageUrl } = await loadWithBase('/api');
    expect(buildAbsoluteImageUrl(42)).toBe(
      `${window.location.origin}/api/file/image/42`,
    );
  });

  it('sem base configurada retorna null', async () => {
    const { buildAbsoluteImageUrl } = await loadWithBase('');
    expect(buildAbsoluteImageUrl(42)).toBeNull();
  });
});

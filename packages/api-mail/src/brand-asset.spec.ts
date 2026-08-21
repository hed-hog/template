import { describe, expect, it } from '@jest/globals';
import { isPublicAssetUrl, resolveBrandAssetUrl } from './brand-asset';

const BASES = {
  appBaseUrl: 'https://admin.example.com',
  apiBaseUrl: 'https://hub-api.hcode.com.br',
};

describe('resolveBrandAssetUrl', () => {
  it('resolve o valor default `/logo.svg` contra a base do front', () => {
    // Este e o bug original: `/logo.svg` e servido pelo Next do admin, mas era
    // resolvido contra a base da API - que nem serve estaticos.
    expect(resolveBrandAssetUrl('/logo.svg', BASES)).toBe(
      'https://admin.example.com/logo.svg',
    );
  });

  it('resolve `/file/...` contra a base da API', () => {
    expect(resolveBrandAssetUrl('/file/image/42', BASES)).toBe(
      'https://hub-api.hcode.com.br/file/image/42',
    );
  });

  it('ignora o prefixo `/api` do rewrite do admin', () => {
    expect(resolveBrandAssetUrl('/api/file/image/42', BASES)).toBe(
      'https://hub-api.hcode.com.br/file/image/42',
    );
  });

  it('nao confunde `/api` com um nome que apenas comeca com "api"', () => {
    expect(resolveBrandAssetUrl('/apifoo.png', BASES)).toBe(
      'https://admin.example.com/apifoo.png',
    );
  });

  it('normaliza caminho sem barra inicial', () => {
    expect(resolveBrandAssetUrl('logo.svg', BASES)).toBe(
      'https://admin.example.com/logo.svg',
    );
  });

  it('remove barras finais da base', () => {
    expect(
      resolveBrandAssetUrl('/logo.svg', {
        appBaseUrl: 'https://admin.example.com///',
        apiBaseUrl: '',
      }),
    ).toBe('https://admin.example.com/logo.svg');
  });

  it('cai na outra base quando a preferencial esta vazia', () => {
    expect(
      resolveBrandAssetUrl('/logo.svg', { apiBaseUrl: 'https://api.x.com' }),
    ).toBe('https://api.x.com/logo.svg');
    expect(
      resolveBrandAssetUrl('/file/image/1', { appBaseUrl: 'https://app.x.com' }),
    ).toBe('https://app.x.com/file/image/1');
  });

  it('devolve string vazia quando nao ha base utilizavel', () => {
    expect(resolveBrandAssetUrl('/logo.svg', {})).toBe('');
    expect(resolveBrandAssetUrl('', BASES)).toBe('');
    expect(resolveBrandAssetUrl(undefined as any, BASES)).toBe('');
  });

  it('deixa `data:` e `http(s)://` intactos', () => {
    expect(resolveBrandAssetUrl('data:image/png;base64,abc', BASES)).toBe(
      'data:image/png;base64,abc',
    );
    expect(resolveBrandAssetUrl('https://cdn.x.com/l.png', BASES)).toBe(
      'https://cdn.x.com/l.png',
    );
    expect(resolveBrandAssetUrl('http://cdn.x.com/l.png', BASES)).toBe(
      'http://cdn.x.com/l.png',
    );
  });

  it('aceita a assinatura legada com a base da API como string', () => {
    // `resolveMailAssetUrl` e publicado no npm com essa assinatura.
    expect(resolveBrandAssetUrl('/logo.svg', 'https://hub-api.hcode.com.br')).toBe(
      'https://hub-api.hcode.com.br/logo.svg',
    );
  });
});

describe('isPublicAssetUrl', () => {
  it('rejeita as URLs que chegavam quebradas no cliente de e-mail', () => {
    expect(isPublicAssetUrl('http://localhost:3100/logo.svg')).toBe(false);
    expect(isPublicAssetUrl('http://hub-api:3100/file/image/1')).toBe(false);
    expect(isPublicAssetUrl('http://10.0.0.5/x.png')).toBe(false);
    expect(isPublicAssetUrl('http://127.0.0.1/x.png')).toBe(false);
    expect(isPublicAssetUrl('http://192.168.1.10/x.png')).toBe(false);
    expect(isPublicAssetUrl('http://172.16.0.2/x.png')).toBe(false);
    expect(isPublicAssetUrl('https://hub-api.hcode.svc.cluster.local/x')).toBe(
      false,
    );
  });

  it('rejeita valor vazio ou caminho relativo', () => {
    expect(isPublicAssetUrl('')).toBe(false);
    expect(isPublicAssetUrl(null)).toBe(false);
    expect(isPublicAssetUrl(undefined)).toBe(false);
    expect(isPublicAssetUrl('/logo.svg')).toBe(false);
  });

  it('aceita host publico e data URI de imagem', () => {
    expect(isPublicAssetUrl('https://admin.example.com/logo.svg')).toBe(true);
    expect(isPublicAssetUrl('http://admin.example.com/logo.svg')).toBe(true);
    expect(isPublicAssetUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('nao se confunde com credenciais na URL', () => {
    expect(isPublicAssetUrl('https://user@localhost/x.png')).toBe(false);
    expect(isPublicAssetUrl('https://user@admin.example.com/x.png')).toBe(true);
  });
});

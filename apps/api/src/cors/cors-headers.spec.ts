import { describe, expect, it } from '@jest/globals';
import { CORS_ALLOWED_HEADERS } from './cors-headers';

/**
 * Cabeçalhos customizados que os front-ends realmente enviam, com a origem de
 * cada um. A lista é repetida aqui de propósito, em vez de importada do código
 * que a injeta: importar o interceptor do CMS ou o provider do admin traria o
 * NestJS e o React para dentro deste teste, e um teste que deriva o esperado da
 * mesma fonte do observado não reprovaria a remoção de um cabeçalho — que é
 * exatamente o que este arquivo existe para pegar.
 */
const CLIENT_HEADERS = [
  // packages/next-app-provider/src/app-provider.tsx
  'X-Browser-ID',
  'X-App-Name',
  'X-App-Platform',
  'X-App-Version',
  // libraries/cms/src/site/cms-site-scope.interceptor.ts (CMS_SITE_HEADER),
  // injetado pelo useRequest() do módulo CMS do admin.
  'X-Cms-Site',
];

const lower = (values: string[]) => values.map((value) => value.toLowerCase());

describe('cors-headers', () => {
  it.each(CLIENT_HEADERS)('permite %s, enviado pelos front-ends', (header) => {
    expect(lower(CORS_ALLOWED_HEADERS)).toContain(header.toLowerCase());
  });

  it('mantém os cabeçalhos básicos de uma requisição autenticada', () => {
    expect(lower(CORS_ALLOWED_HEADERS)).toEqual(
      expect.arrayContaining(
        lower(['Content-Type', 'Authorization', 'Accept-Language'])
      )
    );
  });

  // O navegador manda os nomes em minúsculas no `Access-Control-Request-Headers`
  // e o `cors` compara sem diferenciar caixa: duas grafias do mesmo cabeçalho
  // seriam ruído, e uma delas envelheceria sem ninguém notar.
  it('não repete cabeçalho, nem em outra caixa', () => {
    const normalized = lower(CORS_ALLOWED_HEADERS);
    expect(normalized).toHaveLength(new Set(normalized).size);
  });

  it('não tem entrada vazia nem espaço sobrando', () => {
    for (const header of CORS_ALLOWED_HEADERS) {
      expect(header).toBe(header.trim());
      expect(header).not.toBe('');
    }
  });
});

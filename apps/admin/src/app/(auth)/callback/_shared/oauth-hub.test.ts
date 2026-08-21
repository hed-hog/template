import { describe, expect, it } from 'vitest';
import {
  getHubForwardUrl,
  parseHubState,
  parseHubStateApp,
  resolveAppOrigin,
} from './oauth-hub';

describe('parseHubState', () => {
  it('retorna null quando o state é nulo/indefinido', () => {
    expect(parseHubState(null)).toBeNull();
    expect(parseHubState(undefined)).toBeNull();
  });

  it('retorna null quando o state não começa com "hhweb."', () => {
    expect(parseHubState('other.training.login.sig')).toBeNull();
  });

  it('retorna null quando o state não tem exatamente 4 partes', () => {
    expect(parseHubState('hhweb.training.login')).toBeNull();
    expect(parseHubState('hhweb.training.login.sig.extra')).toBeNull();
  });

  it('retorna null quando o app está vazio', () => {
    expect(parseHubState('hhweb..login.sig')).toBeNull();
  });

  it('retorna null quando o app tem caracteres inválidos', () => {
    expect(parseHubState('hhweb.Training$App.login.sig')).toBeNull();
  });

  it('retorna null quando o flow não é login/register/connect', () => {
    expect(parseHubState('hhweb.training.reset.sig')).toBeNull();
  });

  it('faz parse de um state válido, normalizando caixa e espaços', () => {
    expect(parseHubState('hhweb. Training .LOGIN.sig')).toEqual({
      app: 'training',
      flow: 'login',
    });
  });

  it('aceita os flows register e connect', () => {
    expect(parseHubState('hhweb.training.register.sig')).toEqual({
      app: 'training',
      flow: 'register',
    });
    expect(parseHubState('hhweb.training.connect.sig')).toEqual({
      app: 'training',
      flow: 'connect',
    });
  });
});

describe('parseHubStateApp', () => {
  it('retorna o app de um state válido', () => {
    expect(parseHubStateApp('hhweb.training.login.sig')).toBe('training');
  });

  it('retorna null quando o state é inválido', () => {
    expect(parseHubStateApp('invalid')).toBeNull();
  });
});

describe('resolveAppOrigin', () => {
  it('resolve o origin a partir de uma lista de strings "app=origin"', () => {
    expect(
      resolveAppOrigin(['training=https://training.test', 'admin=https://admin.test'], 'training'),
    ).toBe('https://training.test');
  });

  it('faz parse de app-urls fornecido como string JSON', () => {
    expect(
      resolveAppOrigin(JSON.stringify(['training=https://training.test']), 'training'),
    ).toBe('https://training.test');
  });

  it('retorna [] quando a string não é JSON válido', () => {
    expect(resolveAppOrigin('not-json', 'training')).toBeNull();
  });

  it('retorna null quando appUrls não é um array nem string', () => {
    expect(resolveAppOrigin({ foo: 'bar' }, 'training')).toBeNull();
    expect(resolveAppOrigin(null, 'training')).toBeNull();
  });

  it('ignora itens que não são strings', () => {
    expect(resolveAppOrigin([42, null, 'training=https://training.test'], 'training')).toBe(
      'https://training.test',
    );
  });

  it('ignora itens sem separador "=" ou com "=" na primeira posição', () => {
    expect(resolveAppOrigin(['training-no-equals', '=training'], 'training')).toBeNull();
  });

  it('retorna null quando o app não é encontrado na lista', () => {
    expect(resolveAppOrigin(['admin=https://admin.test'], 'training')).toBeNull();
  });

  it('retorna null quando o valor associado ao app está vazio', () => {
    expect(resolveAppOrigin(['training= '], 'training')).toBeNull();
  });
});

describe('getHubForwardUrl', () => {
  const baseParams = {
    appUrls: ['training=https://training.test'],
    provider: 'google',
    flow: 'login' as const,
    code: 'abc123',
    currentOrigin: 'https://admin.test',
  };

  it('retorna null quando o state não aponta para nenhum app (não é hub state)', () => {
    expect(getHubForwardUrl({ ...baseParams, state: null })).toBeNull();
    expect(getHubForwardUrl({ ...baseParams, state: 'invalid' })).toBeNull();
  });

  it('retorna null quando o app resolvido é desconhecido (sem origin configurado)', () => {
    expect(
      getHubForwardUrl({ ...baseParams, appUrls: [], state: 'hhweb.training.login.sig' }),
    ).toBeNull();
  });

  it('retorna null quando o target origin é igual ao origin atual (mesma origem do hub)', () => {
    expect(
      getHubForwardUrl({
        ...baseParams,
        appUrls: ['training=https://admin.test'],
        state: 'hhweb.training.login.sig',
        currentOrigin: 'https://admin.test',
      }),
    ).toBeNull();
  });

  it('retorna null quando o origin resolvido é inválido (não normalizável)', () => {
    expect(
      getHubForwardUrl({
        ...baseParams,
        appUrls: ['training=not a valid url'],
        state: 'hhweb.training.login.sig',
      }),
    ).toBeNull();
  });

  it('monta a URL de encaminhamento com code e state quando o app é de outra origem', () => {
    const url = getHubForwardUrl({
      ...baseParams,
      state: 'hhweb.training.login.sig',
    });
    expect(url).toBe(
      'https://training.test/callback/google/login?code=abc123&state=hhweb.training.login.sig',
    );
  });

  it('omite o state da query quando ele não é fornecido (embora não seja um hub state válido sem ele)', () => {
    // state vazio não é um hub state válido, então o resultado deve ser null;
    // este teste documenta esse comportamento de borda.
    expect(getHubForwardUrl({ ...baseParams, state: '' })).toBeNull();
  });
});

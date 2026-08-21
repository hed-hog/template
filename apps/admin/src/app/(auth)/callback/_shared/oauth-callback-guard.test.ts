import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOAuthCallbackErrorMessage,
  hasProcessedOAuthCallback,
  markOAuthCallbackAsProcessed,
} from './oauth-callback-guard';

describe('hasProcessedOAuthCallback / markOAuthCallbackAsProcessed', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('retorna false quando o code está vazio', () => {
    expect(hasProcessedOAuthCallback('google', 'login', '')).toBe(false);
  });

  it('retorna false quando o callback ainda não foi processado', () => {
    expect(hasProcessedOAuthCallback('google', 'login', 'abc')).toBe(false);
  });

  it('marca e detecta o callback como processado', () => {
    markOAuthCallbackAsProcessed('google', 'login', 'abc');
    expect(hasProcessedOAuthCallback('google', 'login', 'abc')).toBe(true);
  });

  it('distingue por provider/flow/code (chaves diferentes)', () => {
    markOAuthCallbackAsProcessed('google', 'login', 'abc');
    expect(hasProcessedOAuthCallback('github', 'login', 'abc')).toBe(false);
    expect(hasProcessedOAuthCallback('google', 'register', 'abc')).toBe(false);
    expect(hasProcessedOAuthCallback('google', 'login', 'xyz')).toBe(false);
  });

  it('markOAuthCallbackAsProcessed não faz nada quando o code está vazio', () => {
    markOAuthCallbackAsProcessed('google', 'connect', '');
    expect(hasProcessedOAuthCallback('google', 'connect', '')).toBe(false);
  });

  it('hasProcessedOAuthCallback retorna false quando sessionStorage.getItem lança erro', () => {
    vi.spyOn(window.sessionStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasProcessedOAuthCallback('google', 'login', 'abc')).toBe(false);
  });

  it('markOAuthCallbackAsProcessed ignora falhas do sessionStorage.setItem', () => {
    vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markOAuthCallbackAsProcessed('google', 'login', 'abc')).not.toThrow();
  });
});

describe('getOAuthCallbackErrorMessage', () => {
  it('retorna a mensagem de "já processado" quando a API retorna essa indicação (case-insensitive)', () => {
    const error = { response: { data: { message: 'Code Already Processed' } } };
    expect(getOAuthCallbackErrorMessage(error, 'já processado', 'erro genérico')).toBe(
      'já processado',
    );
  });

  it('retorna a mensagem da resposta quando é uma string comum', () => {
    const error = { response: { data: { message: 'invalid code' } } };
    expect(getOAuthCallbackErrorMessage(error, 'já processado', 'erro genérico')).toBe(
      'invalid code',
    );
  });

  it('junta mensagens quando a resposta é um array não vazio', () => {
    const error = { response: { data: { message: ['erro 1', 'erro 2'] } } };
    expect(getOAuthCallbackErrorMessage(error, 'já processado', 'erro genérico')).toBe(
      'erro 1, erro 2',
    );
  });

  it('retorna a mensagem de fallback quando a resposta é um array vazio', () => {
    const error = { response: { data: { message: [] } } };
    expect(getOAuthCallbackErrorMessage(error, 'já processado', 'erro genérico')).toBe(
      'erro genérico',
    );
  });

  it('retorna a mensagem de fallback quando não há resposta estruturada', () => {
    expect(getOAuthCallbackErrorMessage(new Error('boom'), 'já processado', 'erro genérico')).toBe(
      'erro genérico',
    );
    expect(getOAuthCallbackErrorMessage(null, 'já processado', 'erro genérico')).toBe(
      'erro genérico',
    );
    expect(getOAuthCallbackErrorMessage(undefined, 'já processado', 'erro genérico')).toBe(
      'erro genérico',
    );
  });

  it('retorna a mensagem de fallback quando message não é string nem array', () => {
    const error = { response: { data: { message: 42 } } };
    expect(getOAuthCallbackErrorMessage(error, 'já processado', 'erro genérico')).toBe(
      'erro genérico',
    );
  });
});

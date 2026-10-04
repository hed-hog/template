import { describe, expect, it } from 'vitest';
import { getSessionIdentity, resolveStoredRefreshToken } from './session-tokens';

describe('resolveStoredRefreshToken', () => {
	it('grava o refresh token que a resposta trouxe', () => {
		expect(resolveStoredRefreshToken('antigo', 'novo')).toBe('novo');
	});

	it('mantém o guardado quando a resposta não traz refresh token', () => {
		// Verificar TOTP e desvincular provedor devolvem só um access token novo:
		// apagar aqui destruiria uma sessão de 30 dias ainda válida.
		expect(resolveStoredRefreshToken('antigo', undefined)).toBe('antigo');
		expect(resolveStoredRefreshToken('antigo', null)).toBe('antigo');
		expect(resolveStoredRefreshToken('antigo', '')).toBe('antigo');
	});

	it('aceita não haver nada guardado ainda', () => {
		expect(resolveStoredRefreshToken('', 'novo')).toBe('novo');
		expect(resolveStoredRefreshToken('', undefined)).toBe('');
	});
});

describe('getSessionIdentity', () => {
	const jwt = (payload: Record<string, unknown>) =>
		`h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

	it('não muda quando o token é renovado na mesma sessão', () => {
		// É a renovação que não pode trocar a chave: trocar zera o usuário e os
		// guards de layout desmontam a página no meio do vídeo ou do formulário.
		const before = jwt({ sub: 7, sessionId: 42, exp: 1000 });
		const after = jwt({ sub: 7, sessionId: 42, exp: 2000 });
		expect(getSessionIdentity(before)).toBe('7:42');
		expect(getSessionIdentity(after)).toBe(getSessionIdentity(before));
	});

	it('muda quando a sessão ou o usuário mudam', () => {
		const base = getSessionIdentity(jwt({ sub: 7, sessionId: 42 }));
		expect(getSessionIdentity(jwt({ sub: 7, sessionId: 43 }))).not.toBe(base);
		expect(getSessionIdentity(jwt({ sub: 8, sessionId: 42 }))).not.toBe(base);
	});

	it('aceita token sem sessionId', () => {
		expect(getSessionIdentity(jwt({ sub: 7 }))).toBe('7:');
	});

	it('sem token não há identidade', () => {
		expect(getSessionIdentity('')).toBeNull();
		expect(getSessionIdentity(null)).toBeNull();
		expect(getSessionIdentity(undefined)).toBeNull();
	});

	it('token ilegível vira a própria chave, nunca uma chave compartilhada', () => {
		expect(getSessionIdentity('nao-e-jwt')).toBe('nao-e-jwt');
		expect(getSessionIdentity('a.%%%.c')).toBe('a.%%%.c');
		expect(getSessionIdentity(jwt({ sessionId: 1 }))).toBe(jwt({ sessionId: 1 }));
	});
});

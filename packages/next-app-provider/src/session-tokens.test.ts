import { describe, expect, it } from 'vitest';
import { resolveStoredRefreshToken } from './session-tokens';

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

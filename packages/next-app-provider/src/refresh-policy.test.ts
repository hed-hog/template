import { describe, expect, it, vi } from 'vitest';

import { createRefreshGate, isSessionRejection } from './refresh-policy';

/** Promise que o teste resolve na hora que quiser. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('isSessionRejection', () => {
	it('reconhece 401 e 403 como credencial rejeitada', () => {
		expect(isSessionRejection({ response: { status: 401 } })).toBe(true);
		expect(isSessionRejection({ response: { status: 403 } })).toBe(true);
	});

	// Cada um destes já deslogou alguém com sessão válida: o `catch` do refresh
	// não olhava o status e apagava os tokens em qualquer falha.
	it.each([
		['queda de rede', Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })],
		['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })],
		['502 do ingress', { response: { status: 502 } }],
		['500 da API', { response: { status: 500 } }],
		['429', { response: { status: 429 } }],
		['erro sem forma nenhuma', new TypeError('fetch failed')],
		['nada', undefined],
	])('mantém a sessão em falha transitória: %s', (_label, error) => {
		expect(isSessionRejection(error)).toBe(false);
	});

	it('não confunde o status da requisição original com o do refresh', () => {
		// 401 fora de `response` é o erro da chamada que disparou a renovação, não
		// a resposta do /auth/refresh.
		expect(isSessionRejection({ status: 401 })).toBe(false);
	});
});

describe('createRefreshGate', () => {
	it('N chamadas concorrentes disparam UMA renovação', async () => {
		const gate = createRefreshGate();
		const pending = deferred<string>();
		const task = vi.fn(() => pending.promise);

		const calls = [gate.run(task), gate.run(task), gate.run(task)];
		pending.resolve('token-novo');

		await expect(Promise.all(calls)).resolves.toEqual([
			'token-novo',
			'token-novo',
			'token-novo',
		]);
		expect(task).toHaveBeenCalledTimes(1);
	});

	it('libera o slot depois de resolver', async () => {
		const gate = createRefreshGate();
		const task = vi.fn(async () => 'token');

		await gate.run(task);
		expect(gate.pending()).toBe(false);

		await gate.run(task);
		expect(task).toHaveBeenCalledTimes(2);
	});

	// Sem isto, uma falha transitória prenderia o portão para sempre e nenhuma
	// requisição voltaria a renovar — a tela fica em "carregando" até o reload.
	it('libera o slot depois de falhar, e propaga a falha a todos os esperando', async () => {
		const gate = createRefreshGate();
		const pending = deferred<string>();
		const failing = vi.fn(() => pending.promise);

		const first = gate.run(failing);
		const second = gate.run(failing);
		pending.reject(new Error('rede caiu'));

		await expect(first).rejects.toThrow('rede caiu');
		await expect(second).rejects.toThrow('rede caiu');
		expect(failing).toHaveBeenCalledTimes(1);
		expect(gate.pending()).toBe(false);

		await expect(gate.run(async () => 'token')).resolves.toBe('token');
	});

	// Uma tarefa que lança de forma síncrona não pode deixar o portão preso: se
	// isso acontecesse, ninguém mais renovaria a sessão até o reload da página.
	it('libera o slot quando a tarefa lança de forma síncrona', async () => {
		const gate = createRefreshGate();

		await expect(
			gate.run(() => {
				throw new Error('explodiu antes do await');
			}),
		).rejects.toThrow('explodiu antes do await');

		expect(gate.pending()).toBe(false);
		await expect(gate.run(async () => 'token')).resolves.toBe('token');
	});

	it('acusa a renovação em voo enquanto ela não termina', async () => {
		const gate = createRefreshGate();
		const pending = deferred<string>();

		const running = gate.run(() => pending.promise);
		expect(gate.pending()).toBe(true);

		pending.resolve('token');
		await running;
		expect(gate.pending()).toBe(false);
	});
});

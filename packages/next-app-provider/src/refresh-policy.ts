/**
 * Decisões da renovação de sessão, separadas do provider.
 *
 * Elas moram aqui — e não dentro do `AppContextProvider` — pelo mesmo motivo que
 * o `api-error-policy.ts` do `apps/class`: testar pelo componente exigiria
 * montar o provider inteiro, com router, query client e localStorage, e foi
 * justamente a falta de teste que deixou as duas regressões abaixo passarem.
 */

/**
 * O `/auth/refresh` respondeu que ESTA credencial não vale mais?
 *
 * Só 401 e 403 dizem isso. Queda de rede, timeout, 502 do ingress no meio de um
 * rollout, 5xx da API e 429 dizem "o servidor está mal agora" — e tratar os dois
 * casos igual destrói uma sessão válida de 30 dias por um soluço de rede, ainda
 * por cima chamando `/auth/logout`, que a revoga também no servidor.
 *
 * Fail-closed de propósito: sem resposta, a sessão FICA. O custo de manter uma
 * sessão que o servidor já matou é um 401 na próxima chamada; o de apagar uma
 * sessão viva é o usuário de volta na tela de login.
 *
 * Mesma distinção que `apps/training/lib/auth.ts` e o `apps/class-app` já fazem.
 */
export function isSessionRejection(error: unknown): boolean {
	const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
	return status === 401 || status === 403;
}

export type RefreshGate = {
	/**
	 * Roda `task` se não houver renovação em voo; caso contrário devolve a que já
	 * está rodando. O slot só é liberado quando a tentativa termina — inclusive
	 * falhando.
	 */
	run: (task: () => Promise<string>) => Promise<string>;
	/** Há renovação em voo agora? */
	pending: () => boolean;
};

/**
 * Single-flight da renovação dentro da aba.
 *
 * Substituiu um par booleano + fila de promises. O booleano só cobria quem
 * chegava *durante* a renovação: as requisições que já estavam em voo voltavam
 * 401 depois que ele tinha sido zerado, e cada uma virava líder de uma nova
 * rotação. Como o backend girava a sessão inteira a cada renovação, cada rotação
 * matava os access tokens das outras — em produção, uma sessão nova a cada 1,3 s
 * até alguém apresentar um refresh token já queimado. Aí vinha o 401 do
 * `/auth/refresh`, e o 401 do `/auth/refresh` é logout.
 *
 * Entre abas quem serializa é o Web Locks, do lado do chamador: este portão é
 * por aba porque a promise não atravessa contextos.
 */
export function createRefreshGate(): RefreshGate {
	let inFlight: Promise<string> | null = null;

	return {
		pending: () => inFlight !== null,
		run(task) {
			if (inFlight) return inFlight;

			// `Promise.resolve().then(task)` adia a tarefa em uma microtask, de
			// propósito: se ela lançasse de forma síncrona, o `finally` rodaria antes
			// da atribuição de `inFlight` logo abaixo e o portão ficaria preso numa
			// promise já rejeitada, sem ninguém nunca mais conseguir renovar.
			//
			// A liberação fica no `finally` da própria promise devolvida — e não numa
			// cadeia derivada — para que quem der `await run(...)` já encontre o
			// portão livre, em vez de depender da ordem das microtasks. Um
			// `pending()` que mente por uma microtask faria o refresh proativo do
			// `visibilitychange` desistir à toa.
			//
			// Zerar sem comparar é seguro: só se cria uma tentativa quando o slot
			// está vazio, e ele é preenchido de forma síncrona logo em seguida.
			const attempt = Promise.resolve()
				.then(task)
				.finally(() => {
					inFlight = null;
				});

			inFlight = attempt;

			return attempt;
		},
	};
}

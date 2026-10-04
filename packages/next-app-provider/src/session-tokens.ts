import { decode } from 'js-base64';

/**
 * Regra de gravação da sessão, separada do provider — mesmo motivo do
 * `refresh-policy.ts`: testar pelo componente exigiria montar o provider inteiro,
 * com router, query client e localStorage, e é justamente a falta de teste que
 * deixa passar o detalhe que quebra tudo.
 */

/**
 * Qual refresh token deve ficar guardado depois de uma resposta de autenticação.
 *
 * **Ausente não é vazio.** Nem toda resposta que traz um access token novo traz um
 * refresh token: verificar TOTP e desvincular um provedor OAuth apenas ROTACIONAM o
 * access token da sessão que já existe. Tratar esse caso como "grave o que veio"
 * apagaria a sessão viva e mandaria o usuário para o /login no primeiro 401 —
 * exatamente o desfecho que este módulo existe para evitar.
 *
 * O caminho oposto (gravar o token novo) é o que faltava nos fluxos de MFA, OAuth e
 * checkout do Class, que descartavam o refresh token e deixavam a aba viva só até o
 * access token vencer.
 */
export function resolveStoredRefreshToken(
	current: string,
	incoming?: string | null,
): string {
	return incoming ? incoming : current;
}

/**
 * Identidade estável da sessão que um access token representa: `sub:sessionId`.
 *
 * Existe para chavear as queries que dependem de "quem está logado" (`/auth/verify`,
 * `/auth/roles`). Chaveá-las pelo próprio token fazia toda renovação — a cada
 * `access-token-expiration-minutes`, ao voltar para a aba ou quando outra aba
 * renovava — trocar a chave, zerar o `data` e mostrar o carregando de novo. Os
 * guards de layout trocavam a árvore inteira por um spinner: o vídeo recomeçava e
 * o formulário desmontava, e para quem via aquilo era um F5.
 *
 * A renovação preserva `sub` e `sessionId` (a rotação regrava a mesma linha de
 * `user_session`), então a chave só muda quando a sessão muda de fato: login de
 * outro usuário, simulação de acesso, logout.
 *
 * Token que não dá para ler volta como ele mesmo — melhor refazer a consulta do que
 * arriscar dois usuários dividindo a mesma chave.
 */
export function getSessionIdentity(token: string | null | undefined): string | null {
	if (!token) return null;

	try {
		const payload = token.split('.')[1];
		if (!payload) return token;
		const { sub, sessionId } = JSON.parse(decode(payload)) as {
			sub?: unknown;
			sessionId?: unknown;
		};
		if (sub === undefined || sub === null || sub === '') return token;
		return `${sub}:${sessionId ?? ''}`;
	} catch {
		return token;
	}
}

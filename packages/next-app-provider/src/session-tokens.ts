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

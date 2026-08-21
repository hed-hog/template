/**
 * URL do avatar de uma pessoa do CRM.
 *
 * Espelha `get-photo-url.ts`, que faz o mesmo para a tabela `user`: sao
 * endpoints diferentes, `/user/avatar/:fileId` para usuarios do sistema e
 * `/person/avatar/:fileId` para pessoas do CRM. Os dois sao `@Public()`, entao
 * o `<img>` carrega sem bearer token.
 *
 * Recebe o id do ARQUIVO (`person.avatar_id`), nao o id da pessoa.
 *
 * Devolve `undefined` — e nao um placeholder — quando nao ha avatar, pra o
 * chamador poder pular o `<AvatarImage>` e deixar as iniciais do
 * `<AvatarFallback>` aparecerem sem gastar uma requisicao.
 */
export const getPersonAvatarUrl = (
  avatarId?: number | undefined | null | string
): string | undefined => {
  if (typeof avatarId === 'string') {
    const parsedId = parseInt(avatarId, 10);
    avatarId = isNaN(parsedId) ? undefined : parsedId;
  }

  return typeof avatarId === 'number' && avatarId > 0
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/person/avatar/${avatarId}`
    : undefined;
};

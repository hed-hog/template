'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FacetedMultiPicker,
  type FacetedMultiPickerLoadArgs,
} from './faceted-multi-picker';

type DirectoryUserResponse = {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  avatarFileId: number | null;
};

// Persistimos o e-mail (não o object id do Graph) porque é o que o backend
// espera em `meetingCoorganizerEmails` — a resolução para o id do Entra ID
// acontece no provedor, na hora de criar/atualizar a reunião.
export type EntraCoOrganizerOption = {
  id: string;
  name: string;
  email?: string | null;
  /**
   * Avatar da pessoa correspondente no HedHog, quando a conta do Entra bate com
   * um usuário daqui. Ausente para quem só existe no diretório — aí o próprio
   * componente cai nas iniciais.
   */
  avatarFileId?: number | null;
};

/**
 * Mesmo endpoint público que o seletor de instrutor usa. Ele só serve arquivo
 * que seja avatar de alguma pessoa, então um id vindo de outra origem daria 404
 * — por isso o backend devolve exatamente o `person.avatar_id`.
 */
function avatarUrl(fileId?: number | null): string | undefined {
  return typeof fileId === 'number' && fileId > 0
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/person/avatar/${fileId}`
    : undefined;
}

export type EntraCoOrganizerPickerProps = {
  value: EntraCoOrganizerOption[];
  onChange: (next: EntraCoOrganizerOption[]) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Busca contas do diretório do Entra ID (via `GET
 * /microsoft/meetings/coorganizer-candidates`) para escolher coorganizadores
 * extras da reunião do Teams de uma turma, além do instrutor.
 */
export function EntraCoOrganizerPicker({
  value,
  onChange,
  disabled,
  className,
}: EntraCoOrganizerPickerProps) {
  const { request } = useApp();

  /**
   * Detalhes resolvidos por e-mail, para exibir uma seleção salva do mesmo jeito
   * que uma recém-buscada (nome de verdade e foto, não o endereço cru).
   *
   * Deliberadamente fora do `value`: enriquecer a seleção chamaria `onChange` e
   * marcaria o formulário como alterado sem ninguém ter mexido em nada.
   */
  const [resolved, setResolved] = useState<
    Record<string, { name: string; avatarFileId: number | null }>
  >({});
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = value
      .map((option) => option.id)
      .filter(
        (email) =>
          email &&
          !resolved[email.toLowerCase()] &&
          !requestedRef.current.has(email.toLowerCase()),
      );
    if (missing.length === 0) return;

    // Marca antes de pedir: sem isto, um re-render enquanto a chamada está no ar
    // dispararia a mesma busca de novo.
    for (const email of missing) requestedRef.current.add(email.toLowerCase());

    let active = true;
    request<{ data: DirectoryUserResponse[] }>({
      url: '/microsoft/meetings/coorganizer-candidates',
      method: 'GET',
      params: { emails: missing.join(',') },
    })
      .then((response) => {
        if (!active) return;
        const next: Record<string, { name: string; avatarFileId: number | null }> = {};
        for (const user of response.data?.data ?? []) {
          const email = user.mail || user.userPrincipalName;
          if (!email) continue;
          next[email.toLowerCase()] = {
            name: user.displayName || email,
            avatarFileId: user.avatarFileId,
          };
        }
        setResolved((current) => ({ ...current, ...next }));
      })
      // Conta que não resolve (saiu do diretório, Graph fora do ar) continua
      // aparecendo pelo e-mail — é informação suficiente para remover a linha.
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [value, resolved, request]);

  const detailsFor = useCallback(
    (option: EntraCoOrganizerOption) => resolved[option.id?.toLowerCase()],
    [resolved],
  );

  // Memoizados: `FacetedMultiPicker`/`EntityPicker` colocam estes callbacks na
  // dependência do efeito que recarrega a busca (loadRemoteOptions). Passados
  // como arrow function inline, cada re-render daqui (inclusive o causado pelo
  // próprio `setResolved` acima, que dispara ao resolver um coorganizador
  // recém-selecionado) trocava a identidade dos quatro, forçando um reload da
  // lista no meio da seleção do usuário. (O React #185 ao adicionar um
  // coorganizador vinha de outro lugar: o Checkbox do Radix em cada linha — ver
  // `CheckboxMark` em components/ui/checkbox.tsx.)
  const getOptionValue = useCallback(
    (option: EntraCoOrganizerOption) => option.id,
    [],
  );
  const getOptionLabel = useCallback(
    (option: EntraCoOrganizerOption) => detailsFor(option)?.name ?? option.name,
    [detailsFor],
  );
  const getOptionDescription = useCallback(
    (option: EntraCoOrganizerOption) => option.email || option.id,
    [],
  );
  const getOptionAvatarUrl = useCallback(
    (option: EntraCoOrganizerOption) =>
      avatarUrl(option.avatarFileId ?? detailsFor(option)?.avatarFileId),
    [detailsFor],
  );

  const loadOptions = useCallback(
    async ({ search }: FacetedMultiPickerLoadArgs) => {
      const term = search.trim();
      if (term.length < 2) return [];

      const response = await request<{ data: DirectoryUserResponse[] }>({
        url: '/microsoft/meetings/coorganizer-candidates',
        method: 'GET',
        params: { search: term },
      });

      // Conta sem `mail` nem `userPrincipalName` não serve: é o e-mail que
      // persistimos e que o backend resolve depois no diretório.
      return (response.data?.data ?? []).flatMap<EntraCoOrganizerOption>(
        (user) => {
          const email = user.mail || user.userPrincipalName;
          if (!email) return [];
          return [
            {
              id: email,
              name: user.displayName || email,
              email,
              avatarFileId: user.avatarFileId,
            },
          ];
        },
      );
    },
    [request],
  );

  return (
    <FacetedMultiPicker<EntraCoOrganizerOption>
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder="Buscar conta do Entra ID por nome ou e-mail..."
      searchPlaceholder="Nome ou e-mail"
      emptyStateDescription="Digite ao menos 2 caracteres para buscar no diretório."
      noResultsLabel="Nenhuma conta encontrada"
      loadingLabel="Buscando no diretório..."
      entityLabel="conta"
      disabled={disabled}
      className={className}
      getOptionValue={getOptionValue}
      getOptionLabel={getOptionLabel}
      getOptionDescription={getOptionDescription}
      getOptionAvatarUrl={getOptionAvatarUrl}
    />
  );
}

'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useCallback } from 'react';
import {
  FacetedMultiPicker,
  type FacetedMultiPickerLoadArgs,
} from './faceted-multi-picker';

// Persistimos o e-mail (não o object id do Graph) porque é o que o backend
// espera em `meetingCoorganizerEmails` — a resolução para o id do Entra ID
// acontece no provedor, na hora de criar/atualizar a reunião.
export type EntraCoOrganizerOption = {
  id: string;
  name: string;
  email?: string | null;
};

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

  const loadOptions = useCallback(
    async ({ search }: FacetedMultiPickerLoadArgs) => {
      const term = search.trim();
      if (term.length < 2) return [];

      const response = await request<{
        data: Array<{
          id: string;
          displayName: string;
          mail: string | null;
          userPrincipalName: string;
        }>;
      }>({
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
          return [{ id: email, name: user.displayName || email, email }];
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
      entityLabel="conta"
      disabled={disabled}
      className={className}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.name}
      getOptionDescription={(option) => option.email || undefined}
    />
  );
}

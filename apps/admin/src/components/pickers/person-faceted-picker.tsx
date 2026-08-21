'use client';

import { getPersonAvatarUrl } from '@/lib/get-person-avatar-url';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import {
  FacetedMultiPicker,
  type FacetedMultiPickerLoadArgs,
} from './faceted-multi-picker';

// Quantas tags/valores de metadado aparecem como sugestão ao abrir o campo.
const TAG_SUGGESTION_LIMIT = 20;
const METADATA_SUGGESTION_LIMIT = 15;

// Shape normalizado que os três endpoints (.../people/search,
// .../people/tag-options, .../people/metadata-options) devolvem hoje tanto
// para a turma (`/lms/classes/:id/people`) quanto para o enterprise
// (`/lms/enterprise/:id/people`). O endpoint da turma devolve `nome`; o de
// pessoa "crua" devolve `name` — este componente sempre expõe `name`.
export type PersonPickerOption = {
  id: number;
  name: string;
  email?: string | null;
  avatarId?: number | null;
};

export type PersonFacetedPickerProps = {
  // Base comum aos três endpoints de pessoas, ex.: `/lms/classes/${id}/people`
  // ou `/lms/enterprise/${id}/people`. O componente completa com
  // `/search`, `/tag-options` e `/metadata-options`.
  endpointPrefix: string;
  value: PersonPickerOption[];
  onChange: (next: PersonPickerOption[]) => void;
  entityLabel?: string;
  disabled?: boolean;
  className?: string;
  // A maioria dos chamadores não precisa passar nada aqui — exclusão de quem
  // já está matriculado/já é aluno é resolvida no servidor, dentro do próprio
  // endpoint de busca. Existe só para casos extras de exclusão pontual.
  excludeIds?: Array<number | string>;
  // Faceta "já é aluno / nunca foi" — nem todo domínio tem esse conceito
  // (por isso opt-in); quem passa precisa que o backend aceite `enrollment`.
  showEnrollmentFacet?: boolean;
  // "Selecionar todos que aparecem no filtro" — opt-in porque só faz sentido
  // combinado com um teto de matrícula em lote (ex.: LMS_BULK_ENROLL_MAX_STUDENTS).
  enableSelectAllMatching?: boolean;
  selectAllMatchingFilterMax?: number;
  fillHeight?: boolean;
};

export function PersonFacetedPicker({
  endpointPrefix,
  value,
  onChange,
  entityLabel = 'Person',
  disabled,
  className,
  excludeIds,
  showEnrollmentFacet = false,
  enableSelectAllMatching = false,
  selectAllMatchingFilterMax,
  fillHeight = false,
}: PersonFacetedPickerProps) {
  const { request } = useApp();
  const t = useTranslations('person-picker');

  // As tags de uma pessoa moram em dois lugares: a junção `person_tag` (o que
  // a importação de CSV grava) e `person_metadata['tags']` (o que o
  // formulário de pessoa grava, como texto livre sem linha na tabela `tag`).
  // Este endpoint devolve a união dos dois, identificada pelo slug: sem
  // busca, as mais usadas; com busca, qualquer uma.
  const loadTagOptions = useCallback(
    async (args: { search: string }) => {
      const response = await request<{
        data: Array<{
          id: number | null;
          slug: string;
          color: string | null;
          usageCount: number;
        }>;
      }>({
        url: `${endpointPrefix}/tag-options`,
        method: 'GET',
        params: {
          limit: TAG_SUGGESTION_LIMIT,
          ...(args.search ? { search: args.search } : {}),
        },
      });

      return (response.data?.data ?? []).map((tag) => ({
        slug: tag.slug,
        color: tag.color,
        usageCount: tag.usageCount,
      }));
    },
    [endpointPrefix, request]
  );

  // Sugestões da faceta de metadados: sem chave devolve as chaves em uso, com
  // chave os valores dela já desdobrados (um valor por item, não a célula
  // inteira que a importação gravou).
  const loadMetadataOptions = useCallback(
    async (args: { key?: string; search: string }) => {
      const response = await request<{
        data: Array<{ value: string; usageCount: number }>;
      }>({
        url: `${endpointPrefix}/metadata-options`,
        method: 'GET',
        params: {
          limit: METADATA_SUGGESTION_LIMIT,
          ...(args.key ? { key: args.key } : {}),
          ...(args.search ? { search: args.search } : {}),
        },
      });

      return response.data?.data ?? [];
    },
    [endpointPrefix, request]
  );

  // Único endpoint que ambos os domínios já expõem no mesmo shape
  // `{ items, hasMore, total }`; a única diferença é o nome do campo com o
  // nome da pessoa (`nome` na turma, `name` no cadastro), normalizado aqui.
  const loadPeopleOptions = useCallback(
    async (args: FacetedMultiPickerLoadArgs) => {
      const res = await request<{
        items: Array<{
          id: number;
          nome?: string;
          name?: string;
          email?: string | null;
          avatarId?: number | null;
        }>;
        hasMore: boolean;
        total: number;
      }>({
        url: `${endpointPrefix}/search`,
        method: 'GET',
        params: {
          q: args.search,
          page: args.page,
          pageSize: args.pageSize,
          // Slugs vão como JSON: tag livre vem do formulário e pode conter vírgula.
          ...(args.tagIds.length
            ? { tags: JSON.stringify(args.tagIds.map(String)) }
            : {}),
          ...(args.companyId ? { companyId: args.companyId } : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(args.metadata.length
            ? { metadata: JSON.stringify(args.metadata) }
            : {}),
          ...(args.city ? { city: args.city } : {}),
          ...(args.state ? { state: args.state } : {}),
          ...(args.facets.enrollment
            ? { enrollment: args.facets.enrollment }
            : {}),
          ...(args.excludeIds.length
            ? { excludeIds: args.excludeIds.join(',') }
            : {}),
        },
      });
      const body = res.data ?? res;
      const items: PersonPickerOption[] = (body.items ?? []).map((p) => ({
        id: p.id,
        name: p.nome ?? p.name ?? '',
        email: p.email,
        avatarId: p.avatarId,
      }));
      return {
        items,
        hasMore: Boolean(body.hasMore),
        total: body.total,
      };
    },
    [endpointPrefix, request]
  );

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('statusActive') },
      { value: 'inactive', label: t('statusInactive') },
    ],
    [t]
  );

  const selectFacets = useMemo(
    () =>
      showEnrollmentFacet
        ? [
            {
              key: 'enrollment',
              label: t('filterEnrollmentLabel'),
              placeholder: t('filterEnrollmentPlaceholder'),
              options: [
                { value: 'student', label: t('filterEnrollmentStudent') },
                { value: 'never', label: t('filterEnrollmentNever') },
              ],
            },
          ]
        : [],
    [showEnrollmentFacet, t]
  );

  return (
    <FacetedMultiPicker<PersonPickerOption>
      value={value}
      onChange={onChange}
      loadOptions={loadPeopleOptions}
      placeholder={t('searchPlaceholder')}
      searchPlaceholder={t('searchPlaceholder')}
      noResultsLabel={t('notFound')}
      entityLabel={entityLabel}
      disabled={disabled}
      className={className}
      excludeIds={excludeIds}
      getOptionValue={(p) => p.id}
      getOptionLabel={(p) => p.name}
      getOptionDescription={(p) => p.email || undefined}
      getOptionAvatarUrl={(p) => getPersonAvatarUrl(p.avatarId)}
      loadTagOptions={loadTagOptions}
      tagFilterLabel={t('filterTagLabel')}
      tagFilterEmptyLabel={t('filterTagEmpty')}
      tagFilterSearchPlaceholder={t('filterTagSearchPlaceholder')}
      tagFilterLoadingLabel={t('filterTagLoading')}
      clearFiltersLabel={t('filterClear')}
      showCompanyFilter
      companyFilterLabel={t('filterCompanyLabel')}
      companyFilterPlaceholder={t('filterCompanyPlaceholder')}
      statusOptions={statusOptions}
      statusFilterLabel={t('filterStatusLabel')}
      statusFilterPlaceholder={t('filterStatusPlaceholder')}
      selectFacets={selectFacets}
      showMetadataFilter
      metadataFilterLabel={t('filterMetadataLabel')}
      metadataFilterKeyLabel={t('filterMetadataKeyLabel')}
      metadataFilterKeyPlaceholder={t('filterMetadataKeyPlaceholder')}
      metadataFilterValueLabel={t('filterMetadataValueLabel')}
      metadataFilterValuePlaceholder={t('filterMetadataValuePlaceholder')}
      metadataFilterHint={t('filterMetadataHint')}
      metadataFilterAddLabel={t('filterMetadataAdd')}
      metadataFilterRemoveLabel={t('filterMetadataRemove')}
      loadMetadataOptions={loadMetadataOptions}
      metadataFilterLoadingLabel={t('filterTagLoading')}
      showLocationFilter
      locationFilterLabel={t('filterLocationLabel')}
      locationFilterCityLabel={t('filterLocationCityLabel')}
      locationFilterCityPlaceholder={t('filterLocationCityPlaceholder')}
      locationFilterStateLabel={t('filterLocationStateLabel')}
      locationFilterStatePlaceholder={t('filterLocationStatePlaceholder')}
      selectAllLabel={t('selectAllVisible')}
      selectAllMatchingFilterLabel={
        enableSelectAllMatching
          ? (count) => t('selectAllMatchingFilter', { count })
          : undefined
      }
      selectAllMatchingFilterMax={
        enableSelectAllMatching ? selectAllMatchingFilterMax : undefined
      }
      selectAllMatchingFilterTooManyLabel={
        enableSelectAllMatching
          ? ({ total, max }) =>
              t('selectAllMatchingFilterTooMany', { count: total, max })
          : undefined
      }
      emptySelectionHint={t('noStudentsSelected')}
      fillHeight={fillHeight}
    />
  );
}

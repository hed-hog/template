'use client';

import { Filter, Loader2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EntityPicker,
  type EntityPickerLoadResult,
} from '@/components/ui/entity-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import { LocationFilterPopover } from './location-filter-popover';
import {
  MetadataFiltersPopover,
  type MetadataFilterEntry,
} from './metadata-filters-popover';
import { type MetadataSuggestion } from './metadata-suggest-input';
import { TagFilterPicker, type TagPickerOption } from './tag-filter-picker';
import { TagFilterPopover } from './tag-filter-popover';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FacetedMultiPickerTagOption = {
  id: number | string;
  label: string;
  color?: string | null;
};

export type FacetedMultiPickerStatusOption = {
  value: string;
  label: string;
};

// Um <Select> extra, genérico: o caller nomeia a chave e o valor escolhido chega
// de volta em `args.facets[key]` — evita uma prop dedicada por faceta de domínio.
export type FacetedMultiPickerSelectFacet = {
  key: string;
  label: string;
  placeholder?: string;
  options: FacetedMultiPickerStatusOption[];
};

export type FacetedMultiPickerLoadArgs = {
  page: number;
  pageSize: number;
  search: string;
  // Facet state — always present (empty array/null when unset) so callers can
  // merge them into query params without extra null-checking.
  tagIds: Array<number | string>;
  companyId: number | string | null;
  status: string | null;
  // Pares chave/valor; combinam com AND. Valor vazio = "tem esta chave".
  metadata: MetadataFilterEntry[];
  city: string;
  state: string;
  facets: Record<string, string | null>;
  excludeIds: Array<number | string>;
  extraParams: Record<string, unknown>;
};

export type FacetedMultiPickerProps<
  TOption extends { id: number | string } = {
    id: number | string;
    [key: string]: unknown;
  },
> = {
  // Controlled selection — full option objects (not just ids) so chips render
  // correctly even for items that scrolled out of the currently loaded page.
  value: TOption[];
  onChange: (next: TOption[]) => void;

  // Always fetched server-side: page/search/tagIds/companyId/excludeIds/extraParams
  // are all passed through on every call — this is what makes filtering and
  // paging "server-driven" instead of client-side filtering over a fixed list.
  loadOptions: (
    args: FacetedMultiPickerLoadArgs
  ) => Promise<EntityPickerLoadResult<TOption> | TOption[]>;

  placeholder: string;
  searchPlaceholder?: string;
  emptyStateDescription?: string;
  noResultsLabel?: string;
  loadingLabel?: string;
  loadMoreLabel?: string;
  entityLabel?: string;
  pageSize?: number;
  disabled?: boolean;
  className?: string;

  getOptionValue?: (option: TOption) => string | number;
  getOptionLabel?: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string | undefined;
  getOptionAvatarUrl?: (option: TOption) => string | null | undefined;

  // Generic scoping hooks so a single implementation serves different callers
  // (e.g. "exclude people already added to this account" or "scope to this
  // enterprise's company") without the component knowing about either domain.
  excludeIds?: Array<number | string>;
  extraParams?: Record<string, unknown>;

  // Tag facet — caller supplies the available tags (e.g. from GET /tag); hidden
  // entirely when omitted/empty.
  tagOptions?: FacetedMultiPickerTagOption[];
  // Alternativa ao `tagOptions`: com um loader, a faceta vira um campo com busca
  // no servidor (sugere as mais usadas, digita para achar o resto) e os valores
  // passam a ser slugs. Quem não passa o loader mantém a lista fixa de antes.
  loadTagOptions?: (args: { search: string }) => Promise<TagPickerOption[]>;
  tagFilterLabel?: string;
  tagFilterEmptyLabel?: string;
  tagFilterSearchPlaceholder?: string;
  tagFilterLoadingLabel?: string;
  clearFiltersLabel?: string;

  // Company facet — a self-contained EntityPicker over `/person?type=company`,
  // shown only when explicitly enabled (most call sites don't need it).
  showCompanyFilter?: boolean;
  companyFilterLabel?: string;
  companyFilterPlaceholder?: string;

  // Status facet — caller supplies the available statuses (e.g. active/
  // inactive); hidden entirely when omitted/empty, same opt-in pattern as
  // the tag facet.
  statusOptions?: FacetedMultiPickerStatusOption[];
  statusFilterLabel?: string;
  statusFilterPlaceholder?: string;

  // Metadata facet — one or more free key/value pairs over person_metadata,
  // combined with AND; an empty value means "has this key". Opt-in like the
  // facets above.
  showMetadataFilter?: boolean;
  metadataFilterLabel?: string;
  metadataFilterKeyLabel?: string;
  metadataFilterKeyPlaceholder?: string;
  metadataFilterValueLabel?: string;
  metadataFilterValuePlaceholder?: string;
  metadataFilterHint?: string;
  metadataFilterAddLabel?: string;
  metadataFilterRemoveLabel?: string;
  // Catálogo do que já foi gravado, para sugerir chave e valor: a comparação é
  // por valor exato, então sem sugestão errar a grafia devolve zero em silêncio.
  loadMetadataOptions?: (args: {
    key?: string;
    search: string;
  }) => Promise<MetadataSuggestion[]>;
  metadataFilterLoadingLabel?: string;

  // Location facet — city/state as free text (there is no UF catalog).
  showLocationFilter?: boolean;
  locationFilterLabel?: string;
  locationFilterCityLabel?: string;
  locationFilterCityPlaceholder?: string;
  locationFilterStateLabel?: string;
  locationFilterStatePlaceholder?: string;

  // Extra domain-specific selects, keyed by the caller (values arrive in
  // `args.facets`).
  selectFacets?: FacetedMultiPickerSelectFacet[];

  removeSelectedLabel?: string;
  emptySelectionHint?: string;
  // Label for the "select all" control shown above the currently loaded/
  // visible options. Hidden when omitted.
  selectAllLabel?: string;
  // "Select every match across all pages" — opt-in alongside selectAllLabel,
  // only shown once the server-reported total exceeds what's currently loaded
  // (no point offering it for a single page of results). Fetches every match
  // via the same loadOptions the picker already uses and merges it into
  // `value` — the caller doesn't need to wire anything beyond the label.
  selectAllMatchingFilterLabel?: (total: number) => string;
  // Above this count, the action is replaced by selectAllMatchingFilterTooManyLabel
  // instead of firing a fetch for however many matches there are. Omit for no cap.
  selectAllMatchingFilterMax?: number;
  selectAllMatchingFilterTooManyLabel?: (args: {
    total: number;
    max: number;
  }) => string;
  // Makes the option list grow into the vertical space the parent gives it
  // (the parent must be a flex column with a bounded height). For pickers that
  // own a full-height panel instead of sitting in a form.
  fillHeight?: boolean;
};

type PersonCompanyOption = { id: number; name: string };

// Cada faceta ocupa uma fatia igual da linha (min. 10rem antes de quebrar), em
// vez de larguras fixas que deixavam sobra à direita.
const FACET_SLOT_CLASS = 'min-w-40 flex-1';
const FACET_CONTROL_CLASS = 'min-w-40 flex-1 justify-start';

function getInitials(label: string) {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Component ────────────────────────────────────────────────────────────────

export function FacetedMultiPicker<
  TOption extends { id: number | string } = {
    id: number | string;
    [key: string]: unknown;
  },
>({
  value,
  onChange,
  loadOptions,
  placeholder,
  searchPlaceholder,
  emptyStateDescription,
  noResultsLabel,
  loadingLabel,
  loadMoreLabel,
  entityLabel,
  pageSize = 20,
  disabled = false,
  className,
  getOptionValue,
  getOptionLabel,
  getOptionDescription,
  getOptionAvatarUrl,
  excludeIds = [],
  extraParams = {},
  tagOptions = [],
  loadTagOptions,
  tagFilterLabel = 'Tags',
  tagFilterEmptyLabel = 'Nenhuma tag cadastrada.',
  tagFilterSearchPlaceholder = 'Buscar tag...',
  tagFilterLoadingLabel = 'Carregando...',
  clearFiltersLabel = 'Limpar',
  showCompanyFilter = false,
  companyFilterLabel = 'Empresa',
  companyFilterPlaceholder = 'Filtrar por empresa',
  statusOptions = [],
  statusFilterLabel = 'Status',
  statusFilterPlaceholder = 'Status',
  showMetadataFilter = false,
  metadataFilterLabel = 'Metadados',
  metadataFilterKeyLabel = 'Chave',
  metadataFilterKeyPlaceholder = 'ex.: turma_origem',
  metadataFilterValueLabel = 'Valor',
  metadataFilterValuePlaceholder = 'ex.: 2026-1',
  metadataFilterHint = 'Deixe o valor vazio para buscar quem tem a chave.',
  metadataFilterAddLabel = 'Adicionar metadado',
  metadataFilterRemoveLabel = 'Remover',
  loadMetadataOptions,
  metadataFilterLoadingLabel,
  showLocationFilter = false,
  locationFilterLabel = 'Localização',
  locationFilterCityLabel = 'Cidade',
  locationFilterCityPlaceholder = 'ex.: São Paulo',
  locationFilterStateLabel = 'UF',
  locationFilterStatePlaceholder = 'SP',
  selectFacets = [],
  removeSelectedLabel,
  emptySelectionHint,
  selectAllLabel,
  selectAllMatchingFilterLabel,
  selectAllMatchingFilterMax,
  selectAllMatchingFilterTooManyLabel,
  fillHeight = false,
}: FacetedMultiPickerProps<TOption>) {
  const { request } = useApp();
  const [pickerValue, setPickerValue] = useState('');
  const [selectingAllMatching, setSelectingAllMatching] = useState(false);
  const [tagIds, setTagIds] = useState<Array<number | string>>([]);
  const [companyId, setCompanyId] = useState<number | string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [metadataFilters, setMetadataFilters] = useState<MetadataFilterEntry[]>(
    []
  );
  const [locationFilter, setLocationFilter] = useState({ city: '', state: '' });
  const [facetValues, setFacetValues] = useState<Record<string, string | null>>(
    {}
  );

  // Os campos de texto são digitados, não escolhidos numa lista — sem debounce
  // cada tecla viraria um request (o refreshToken abaixo depende deles).
  const debouncedMetadataFilters = useDebounce(metadataFilters);
  const debouncedCity = useDebounce(locationFilter.city);
  const debouncedState = useDebounce(locationFilter.state);

  // Linhas em branco (recém-adicionadas, ainda sem chave) não viram filtro.
  const appliedMetadataFilters = useMemo(
    () =>
      debouncedMetadataFilters
        .map((entry) => ({
          key: entry.key.trim(),
          value: entry.value.trim(),
        }))
        .filter((entry) => entry.key.length > 0),
    [debouncedMetadataFilters]
  );

  const metadataToken = useMemo(
    () =>
      appliedMetadataFilters
        .map((entry) => `${entry.key}=${entry.value}`)
        .join('&'),
    [appliedMetadataFilters]
  );

  const facetsToken = useMemo(
    () =>
      Object.entries(facetValues)
        .filter(([, facetValue]) => facetValue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, facetValue]) => `${key}:${facetValue}`)
        .join(','),
    [facetValues]
  );

  const hasActiveFilters =
    tagIds.length > 0 ||
    Boolean(companyId) ||
    Boolean(statusId) ||
    metadataFilters.some((entry) => entry.key.trim()) ||
    Boolean(locationFilter.city.trim()) ||
    Boolean(locationFilter.state.trim()) ||
    facetsToken.length > 0;

  const handleClearFilters = () => {
    setTagIds([]);
    setCompanyId(null);
    setStatusId(null);
    setMetadataFilters([]);
    setLocationFilter({ city: '', state: '' });
    setFacetValues({});
  };

  const resolveValue = useCallback(
    (option: TOption): string | number =>
      getOptionValue ? getOptionValue(option) : option.id,
    [getOptionValue]
  );

  const resolveLabel = useCallback(
    (option: TOption): string => {
      if (getOptionLabel) return getOptionLabel(option);
      const knownOption = option as Partial<{ label: string; name: string }>;
      return knownOption.label ?? knownOption.name ?? String(resolveValue(option));
    },
    [getOptionLabel, resolveValue]
  );

  const selectedIds = useMemo(
    () => new Set(value.map((option) => String(resolveValue(option)))),
    [value, resolveValue]
  );

  const handleLoadOptions = useCallback(
    (args: { page: number; pageSize: number; search: string }) =>
      loadOptions({
        ...args,
        tagIds,
        companyId,
        status: statusId,
        metadata: appliedMetadataFilters,
        city: debouncedCity.trim(),
        state: debouncedState.trim(),
        facets: facetValues,
        excludeIds,
        extraParams,
      }),
    [
      loadOptions,
      tagIds,
      companyId,
      statusId,
      appliedMetadataFilters,
      debouncedCity,
      debouncedState,
      facetValues,
      excludeIds,
      extraParams,
    ]
  );

  const loadCompanyOptions = useCallback(
    async (args: { page: number; pageSize: number; search: string }) => {
      const params = new URLSearchParams({
        page: String(args.page),
        pageSize: String(args.pageSize),
        type: 'company',
      });
      if (args.search.trim()) params.set('search', args.search.trim());

      const res = await request<any>({
        url: `/person?${params.toString()}`,
        method: 'GET',
      });
      const body = res?.data ?? res;
      const items: PersonCompanyOption[] = (body?.data ?? []).map(
        (p: any) => ({ id: p.id, name: p.name ?? '' })
      );
      const page = body?.page ?? 1;
      const lastPage = body?.lastPage ?? 1;
      return { items, hasMore: page < lastPage };
    },
    [request]
  );

  // Toggles one option in/out of the selection — the list stays open
  // (closeOnSelect=false below) so an admin can check off several people
  // without reopening the popover between clicks.
  const handleToggleOption = (option: TOption) => {
    const key = String(resolveValue(option));
    if (selectedIds.has(key)) {
      onChange(value.filter((item) => String(resolveValue(item)) !== key));
    } else {
      onChange([...value, option]);
    }
    setPickerValue('');
  };

  const handleRemoveOption = (option: TOption) => {
    const key = String(resolveValue(option));
    onChange(value.filter((item) => String(resolveValue(item)) !== key));
  };

  // "Selecionar todos que aparecem no filtro": busca o conjunto inteiro pelo
  // mesmo handleLoadOptions que a lista já usa (mesmas facetas, mesma busca) e
  // junta ao que já estava selecionado — o caller não precisa fiar nada além
  // do rótulo, a mecânica é a mesma que já monta a página atual.
  const handleSelectAllMatchingFilter = async (search: string, total: number) => {
    if (selectingAllMatching) return;

    setSelectingAllMatching(true);
    try {
      const result = await handleLoadOptions({ page: 1, pageSize: total, search });
      const items = Array.isArray(result) ? result : result.items ?? [];

      const existingIds = new Set(
        value.map((option) => String(resolveValue(option)))
      );
      const toAdd = items.filter(
        (option) => !existingIds.has(String(resolveValue(option)))
      );

      if (toAdd.length > 0) {
        onChange([...value, ...toAdd]);
      }
    } finally {
      setSelectingAllMatching(false);
    }
  };

  // "Select all" toggles only the options currently loaded/visible in the
  // list (post search + facet filters) — never the full unfiltered result
  // set, since most of it hasn't been fetched yet.
  const handleToggleAllVisible = (visibleOptions: TOption[]) => {
    const visibleKeys = new Set(
      visibleOptions.map((option) => String(resolveValue(option)))
    );
    const allVisibleSelected = visibleOptions.every((option) =>
      selectedIds.has(String(resolveValue(option)))
    );

    if (allVisibleSelected) {
      onChange(value.filter((item) => !visibleKeys.has(String(resolveValue(item)))));
    } else {
      const toAdd = visibleOptions.filter(
        (option) => !selectedIds.has(String(resolveValue(option)))
      );
      onChange([...value, ...toAdd]);
    }
  };

  return (
    <div
      className={cn(
        fillHeight ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3',
        className
      )}
    >
      {/* Barra de facetas — cada controle é `flex-1` com uma largura mínima, de
          modo que os que couberem dividam a linha inteira e o excedente quebre
          para a linha seguinte, também preenchendo-a. */}
      {tagOptions.length > 0 ||
      loadTagOptions ||
      showCompanyFilter ||
      statusOptions.length > 0 ||
      showMetadataFilter ||
      showLocationFilter ||
      selectFacets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {loadTagOptions ? (
            <TagFilterPicker
              value={tagIds.map(String)}
              onChange={setTagIds}
              loadOptions={loadTagOptions}
              label={tagFilterLabel}
              searchPlaceholder={tagFilterSearchPlaceholder}
              emptyLabel={tagFilterEmptyLabel}
              loadingLabel={tagFilterLoadingLabel}
              clearLabel={clearFiltersLabel}
              disabled={disabled}
              className={FACET_CONTROL_CLASS}
            />
          ) : (
            <TagFilterPopover
              options={tagOptions}
              value={tagIds}
              onChange={setTagIds}
              label={tagFilterLabel}
              emptyLabel={tagFilterEmptyLabel}
              clearLabel={clearFiltersLabel}
              disabled={disabled}
              className={FACET_CONTROL_CLASS}
            />
          )}

          {showCompanyFilter ? (
            <div className={FACET_SLOT_CLASS}>
              <EntityPicker<PersonCompanyOption>
                value={companyId}
                onChange={(nextValue) => setCompanyId(nextValue)}
                loadOptions={loadCompanyOptions}
                placeholder={companyFilterPlaceholder}
                searchPlaceholder={companyFilterPlaceholder}
                entityLabel={companyFilterLabel}
                showCreateButton={false}
                clearable
                disabled={disabled}
                getOptionValue={(o) => o.id}
                getOptionLabel={(o) => o.name}
                buttonClassName="w-full"
              />
            </div>
          ) : null}

          {statusOptions.length > 0 ? (
            <Select
              value={statusId ?? '__all__'}
              onValueChange={(next) =>
                setStatusId(next === '__all__' ? null : next)
              }
            >
              <SelectTrigger
                className={FACET_CONTROL_CLASS}
                disabled={disabled}
                size="sm"
              >
                <SelectValue placeholder={statusFilterPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{statusFilterLabel}</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {selectFacets.map((facet) => (
            <Select
              key={facet.key}
              value={facetValues[facet.key] ?? '__all__'}
              onValueChange={(next) =>
                setFacetValues((prev) => ({
                  ...prev,
                  [facet.key]: next === '__all__' ? null : next,
                }))
              }
            >
              <SelectTrigger
                className={FACET_CONTROL_CLASS}
                disabled={disabled}
                size="sm"
              >
                <SelectValue placeholder={facet.placeholder ?? facet.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{facet.label}</SelectItem>
                {facet.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {showMetadataFilter ? (
            <MetadataFiltersPopover
              filters={metadataFilters}
              onChange={setMetadataFilters}
              label={metadataFilterLabel}
              keyLabel={metadataFilterKeyLabel}
              keyPlaceholder={metadataFilterKeyPlaceholder}
              valueLabel={metadataFilterValueLabel}
              valuePlaceholder={metadataFilterValuePlaceholder}
              hint={metadataFilterHint}
              addLabel={metadataFilterAddLabel}
              removeLabel={metadataFilterRemoveLabel}
              clearLabel={clearFiltersLabel}
              loadOptions={loadMetadataOptions}
              loadingLabel={metadataFilterLoadingLabel}
              disabled={disabled}
              className={FACET_CONTROL_CLASS}
            />
          ) : null}

          {showLocationFilter ? (
            <LocationFilterPopover
              city={locationFilter.city}
              state={locationFilter.state}
              onChange={setLocationFilter}
              label={locationFilterLabel}
              cityLabel={locationFilterCityLabel}
              cityPlaceholder={locationFilterCityPlaceholder}
              stateLabel={locationFilterStateLabel}
              statePlaceholder={locationFilterStatePlaceholder}
              clearLabel={clearFiltersLabel}
              disabled={disabled}
              className={FACET_CONTROL_CLASS}
            />
          ) : null}

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 cursor-pointer gap-1.5 text-muted-foreground"
              onClick={handleClearFilters}
            >
              <Filter className="size-3.5" />
              {clearFiltersLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Main person picker — search/pagination/facets all resolved server-side
          via handleLoadOptions, which re-runs from page 1 whenever the facet
          state below changes (EntityPicker's refreshToken). */}
      <EntityPicker<TOption>
        value={pickerValue}
        onChange={(_nextValue, option) => {
          if (option) handleToggleOption(option);
        }}
        loadOptions={handleLoadOptions}
        refreshToken={[
          tagIds.join(','),
          companyId ?? '',
          statusId ?? '',
          metadataToken,
          debouncedCity.trim(),
          debouncedState.trim(),
          facetsToken,
        ].join('|')}
        pageSize={pageSize}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder ?? placeholder}
        emptyStateDescription={emptyStateDescription}
        noResultsLabel={noResultsLabel}
        loadingLabel={loadingLabel}
        loadMoreLabel={loadMoreLabel}
        entityLabel={entityLabel}
        showCreateButton={false}
        clearable={false}
        disabled={disabled}
        closeOnSelect={false}
        // Melhorar o Picker de alunos: lista paginada sempre visível (não escondida atrás de
        // um clique) e input de busca w-full — a seção de "selecionados" já fica separada,
        // abaixo (ver "Selected chips").
        variant="inline"
        fillHeight={fillHeight}
        className={cn(fillHeight && 'min-h-0 flex-1')}
        getOptionValue={(option) => resolveValue(option)}
        getOptionLabel={(option) => resolveLabel(option)}
        getOptionDescription={getOptionDescription}
        renderListHeader={
          selectAllLabel || selectAllMatchingFilterLabel
            ? ({ visibleOptions, total, search }) => {
                if (visibleOptions.length === 0) return null;
                const allSelected = visibleOptions.every((option) =>
                  selectedIds.has(String(resolveValue(option)))
                );
                const someSelected =
                  !allSelected &&
                  visibleOptions.some((option) =>
                    selectedIds.has(String(resolveValue(option)))
                  );
                return (
                  <div className="flex flex-col gap-1.5 border-b px-3 py-2">
                    {selectAllLabel ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={() => handleToggleAllVisible(visibleOptions)}
                          disabled={disabled}
                          aria-label={selectAllLabel}
                        />
                        <button
                          type="button"
                          className="cursor-pointer text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleAllVisible(visibleOptions)}
                        >
                          {selectAllLabel}
                        </button>
                      </div>
                    ) : null}
                    {/* Só faz sentido oferecer "selecionar todos que aparecem no filtro"
                        quando existe mais gente batendo com o filtro do que o que já
                        está carregado na tela — senão é a mesma coisa que a página atual.
                        Acima do teto, mostra o aviso pra refinar em vez do botão — não
                        adianta deixar clicar pra só então descobrir que passou do limite. */}
                    {selectAllMatchingFilterLabel &&
                    total != null &&
                    total > visibleOptions.length ? (
                      selectAllMatchingFilterMax != null &&
                      total > selectAllMatchingFilterMax ? (
                        <p className="pl-6 text-xs text-muted-foreground">
                          {selectAllMatchingFilterTooManyLabel?.({
                            total,
                            max: selectAllMatchingFilterMax,
                          })}
                        </p>
                      ) : (
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-1.5 pl-6 text-left text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleSelectAllMatchingFilter(search, total)}
                          disabled={disabled || selectingAllMatching}
                        >
                          {selectingAllMatching ? (
                            <Loader2 className="size-3 shrink-0 animate-spin" />
                          ) : null}
                          {selectAllMatchingFilterLabel(total)}
                        </button>
                      )
                    ) : null}
                  </div>
                );
              }
            : undefined
        }
        renderOption={({ option }) => {
          const label = resolveLabel(option);
          const description = getOptionDescription?.(option);
          const avatarUrl = getOptionAvatarUrl?.(option);
          const isChosen = selectedIds.has(String(resolveValue(option)));

          return (
            <div className="flex min-w-0 items-center gap-2.5 py-0.5">
              <Checkbox checked={isChosen} className="shrink-0" />
              <Avatar className="size-7 shrink-0 rounded-full">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={label} /> : null}
                <AvatarFallback className="text-xs font-semibold">
                  {getInitials(label)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate">{label}</div>
                {description ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {description}
                  </div>
                ) : null}
              </div>
            </div>
          );
        }}
      />

      {/* Selected chips — com fillHeight ganham um teto próprio de rolagem para
          que uma seleção longa não vá comendo a altura da lista. */}
      {value.length > 0 ? (
        <div
          className={cn(
            'flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-muted/20 p-2.5',
            fillHeight && 'max-h-32 shrink-0 overflow-y-auto'
          )}
        >
          {value.map((option) => {
            const key = String(resolveValue(option));
            const label = resolveLabel(option);
            const avatarUrl = getOptionAvatarUrl?.(option);

            return (
              <Badge
                key={key}
                variant="secondary"
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-1 text-xs font-medium text-foreground"
              >
                <Avatar className="size-5 shrink-0">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={label} />
                  ) : null}
                  <AvatarFallback className="text-[9px] font-medium">
                    {getInitials(label)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-45 truncate">{label}</span>
                <button
                  type="button"
                  className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => handleRemoveOption(option)}
                  aria-label={removeSelectedLabel ?? `Remover ${label}`}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : emptySelectionHint ? (
        <div
          className={cn(
            'rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground',
            fillHeight && 'shrink-0'
          )}
        >
          {emptySelectionHint}
        </div>
      ) : null}
    </div>
  );
}

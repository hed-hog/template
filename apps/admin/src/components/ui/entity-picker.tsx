'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Controller,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { InputMoney } from '@/components/ui/input-money';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ResizableSheetContent } from '@/components/ui/resizable-sheet-content';
import { cn } from '@/lib/utils';

export type EntityPickerValue = string | number | null;

type EntityPickerKnownFields = {
  id?: string | number | null;
  label?: string;
  name?: string;
  title?: string;
  code?: string | null;
  description?: string | null;
};

export type EntityPickerOption = EntityPickerKnownFields & {
  [key: string]: unknown;
};

export type EntityPickerCreateField = {
  name: string;
  label: string;
  placeholder?: string;
  /**
   * `money` renderiza o campo com a máscara em reais do `InputMoney`; o valor
   * entregue ao `onCreate` continua sendo a string mascarada ("1.234,56"), que
   * o consumidor converte com `parseMoneyToCents`.
   */
  type?: 'text' | 'email' | 'password' | 'number' | 'money';
  required?: boolean;
  defaultValue?: string;
};

export type EntityPickerLoadResult<TOption> = {
  items: TOption[];
  hasMore?: boolean;
  // Total record count across all pages — when present, `variant="inline"` shows a real
  // Prev/Next paginated footer (page X of Y) instead of the "load more" button. Omit it (or
  // omit `total` from every page) to keep the load-more behavior in inline mode too.
  total?: number;
};

/**
 * Imagem que identifica a opção: avatar da pessoa, logo da empresa, avatar do
 * cliente do projeto. Sem `src`, o círculo mostra as iniciais de `fallback`
 * (ou do rótulo da opção).
 */
export type EntityPickerAvatar = {
  src?: string | null;
  fallback?: string;
};

function getInitials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function EntityPickerAvatarView({
  avatar,
  label,
  shape,
  className,
}: {
  avatar: EntityPickerAvatar;
  label: string;
  shape: 'circle' | 'square';
  className?: string;
}) {
  return (
    <Avatar
      className={cn(
        'size-6 shrink-0',
        shape === 'square' && 'rounded-md',
        className
      )}
    >
      {avatar.src ? (
        <AvatarImage src={avatar.src} alt={label} className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn('text-[10px]', shape === 'square' && 'rounded-md')}
      >
        {getInitials(avatar.fallback || label)}
      </AvatarFallback>
    </Avatar>
  );
}

export type EntityPickerCreateContext<TOption> = {
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
  isCreating: boolean;
  closeCreate: () => void;
  submitCreate: () => Promise<void>;
  selectCreated: (option: TOption) => void;
  search: string;
  setSearch: (value: string) => void;
};

export type EntityPickerProps<
  TOption extends object = EntityPickerOption,
  TFieldValues extends FieldValues = FieldValues,
> = {
  form?: UseFormReturn<TFieldValues>;
  name?: Path<TFieldValues>;
  value?: EntityPickerValue;
  onChange?: (value: EntityPickerValue, option: TOption | null) => void;
  label?: string;
  placeholder: string;
  emptyLabel?: string;
  entityLabel?: string;
  errorMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  showCreateButton?: boolean;
  allowEmptySelection?: boolean;
  emptySelectionLabel?: string;
  valueType?: 'string' | 'number';
  initialSelectedLabel?: string;
  /**
   * Avatar da opção já selecionada quando ela ainda não está carregada na
   * lista (edição de um registro existente). Só vale com `getOptionAvatar`.
   */
  initialSelectedAvatar?: EntityPickerAvatar | null;
  searchPlaceholder?: string;
  emptyStateDescription?: string;
  loadingLabel?: string;
  createActionLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  loadMoreLabel?: string;
  createTitle?: string;
  createDescription?: string;
  createPlaceholder?: string;
  noResultsLabel?: string;
  className?: string;
  buttonClassName?: string;
  // 'popover' (default): current combobox behavior, list hidden behind a trigger button.
  // 'inline': renders the search input + paginated list directly, always visible — for
  // multi-select record-picking UX where hiding the list behind a click is the wrong pattern
  // (e.g. FacetedMultiPicker).
  variant?: 'popover' | 'inline';
  options?: TOption[];
  debounceMs?: number;
  pageSize?: number;
  visibleCountStep?: number;
  refreshToken?: unknown;
  loadOptions?: (args: {
    page: number;
    pageSize: number;
    search: string;
  }) => Promise<EntityPickerLoadResult<TOption> | TOption[]>;
  getOptionValue?: (option: TOption) => string | number | null | undefined;
  getOptionLabel?: (option: TOption) => string;
  getOptionDescription?: (option: TOption) => string | undefined;
  getOptionSearchText?: (option: TOption) => string;
  /**
   * Padrão do admin: sempre que a entidade tiver uma imagem que a identifique
   * (avatar, logo, foto, avatar do cliente), passe-a aqui. Ela aparece na lista
   * e no campo; sem imagem, as iniciais ocupam o lugar. `null` esconde o avatar
   * daquela opção.
   */
  getOptionAvatar?: (option: TOption) => EntityPickerAvatar | null | undefined;
  avatarShape?: 'circle' | 'square';
  renderOption?: (args: {
    option: TOption;
    isSelected: boolean;
    isDisabled: boolean;
  }) => ReactNode;
  renderSelectedValue?: (args: {
    option: TOption | null;
    value: string;
    label: string;
  }) => ReactNode;
  isOptionDisabled?: (option: TOption) => boolean;
  // When false, selecting an option keeps the popover open instead of closing
  // it — used by multi-select wrappers (e.g. FacetedMultiPicker) so several
  // items can be toggled in one open/close cycle. Defaults to true so every
  // existing single-select call site keeps its current behavior.
  closeOnSelect?: boolean;
  // Rendered above the option list, outside the scrollable CommandList, with
  // the options currently loaded/visible (post search + facet filters). Lets
  // a multi-select wrapper inject a "select all" control scoped to what the
  // user actually sees. `total`/`search` (when loadOptions supplies a real
  // total) let it also offer a "select every match across all pages" action —
  // null total means the caller never returned one, so that action stays hidden.
  renderListHeader?: (args: {
    visibleOptions: TOption[];
    total: number | null;
    search: string;
  }) => ReactNode;
  // `variant="inline"` only: the list stretches to the height its container
  // gives it (instead of a CommandList's fixed max-height) and the pagination
  // footer is pinned below the scroll area. For pickers inside a full-height
  // sheet, where cutting the list at 300px wastes most of the panel.
  fillHeight?: boolean;
  onCreate?: (
    values: Record<string, string>
  ) => Promise<TOption | null | void> | TOption | null | void;
  /**
   * Abre o sheet de cadastro da própria entidade (o completo, não o resumido
   * do picker) no lugar do sheet interno. Recebe o texto buscado para
   * pré-preencher; quem chama seleciona o registro criado via `value`.
   */
  onCreateClick?: (search: string) => void;
  /**
   * Mostra o lápis ao lado do campo enquanto houver seleção: abre o sheet de
   * edição da entidade selecionada.
   */
  onEditSelection?: (value: string | number, option: TOption | null) => void;
  editActionLabel?: string;
  createFields?: EntityPickerCreateField[];
  mapSearchToCreateValues?: (search: string) => Record<string, string>;
  renderCreateContent?: (ctx: EntityPickerCreateContext<TOption>) => ReactNode;
  createSheetClassName?: string;
  createSheetId?: string;
  createSheetDefaultWidth?: number;
  createSheetMinWidth?: number;
  createSheetMaxWidth?: number;
  disableCreateSheetResize?: boolean;
};

function getNestedValue(option: object, key: string) {
  return key.split('.').reduce<unknown>((acc, part) => {
    // Defensive guard: the only call site below always passes the
    // single-segment key 'id', so the reduce runs exactly once with
    // `option` (a valid object) as `acc`; this branch would only fire for a
    // multi-segment key whose intermediate value is missing, which never
    // happens with the current call site.
    /* v8 ignore next 3 */
    if (!acc || typeof acc !== 'object') {
      return undefined;
    }

    return (acc as Record<string, unknown>)[part];
  }, option);
}

function mergeUniqueOptions<TOption extends object>(
  base: TOption[],
  extra: TOption[],
  getKey: (option: TOption) => string
) {
  const merged = new Map<string, TOption>();

  for (const option of base) {
    merged.set(getKey(option), option);
  }

  for (const option of extra) {
    merged.set(getKey(option), option);
  }

  return Array.from(merged.values());
}

// Mesmo algoritmo de PaginationNav (apps/training): sempre mostra primeira/última página,
// a página atual ± 1 vizinha, e "…" nos vazios. Ex. 20 páginas, atual = 8 → [1, "…", 7, 8, 9, "…", 20]
function buildPageRange(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const delta = 1;
  const range = new Set<number>([1, totalPages]);
  for (
    let i = Math.max(2, page - delta);
    i <= Math.min(totalPages - 1, page + delta);
    i++
  ) {
    range.add(i);
  }

  const sorted = Array.from(range).sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) result.push('…');
    result.push(n);
    prev = n;
  }

  return result;
}

// Diacríticos combinantes removidos por código, não por literal no regex: a
// busca local casa "joao" com "João" sem depender da codificação do arquivo.
const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < COMBINING_START || code > COMBINING_END;
    })
    .join('')
    .toLowerCase();
}

function normalizeLoadResult<TOption extends object>(
  payload: EntityPickerLoadResult<TOption> | TOption[]
) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      hasMore: false,
      total: undefined as number | undefined,
    };
  }

  return {
    items: payload.items ?? [],
    hasMore: payload.hasMore ?? false,
    total: payload.total,
  };
}

export function EntityPicker<
  TOption extends object = EntityPickerOption,
  TFieldValues extends FieldValues = FieldValues,
>({
  form,
  name,
  value,
  onChange,
  label,
  placeholder,
  emptyLabel,
  entityLabel,
  errorMessage,
  disabled = false,
  clearable = true,
  searchable = true,
  showCreateButton = true,
  allowEmptySelection = false,
  emptySelectionLabel,
  valueType = 'string',
  initialSelectedLabel = '',
  initialSelectedAvatar,
  searchPlaceholder,
  emptyStateDescription = 'Nenhum resultado encontrado.',
  loadingLabel = 'Carregando...',
  createActionLabel,
  saveLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  loadMoreLabel = 'Carregar mais',
  createTitle,
  createDescription,
  createPlaceholder,
  noResultsLabel = 'Nenhum resultado encontrado.',
  className,
  buttonClassName,
  variant = 'popover',
  options = [],
  debounceMs = 300,
  pageSize = 20,
  visibleCountStep = 20,
  refreshToken,
  loadOptions,
  getOptionValue,
  getOptionLabel,
  getOptionDescription,
  getOptionSearchText,
  getOptionAvatar,
  avatarShape = 'circle',
  renderOption,
  renderSelectedValue,
  isOptionDisabled,
  closeOnSelect = true,
  renderListHeader,
  fillHeight = false,
  onCreate,
  onCreateClick,
  onEditSelection,
  editActionLabel,
  createFields = [],
  mapSearchToCreateValues,
  renderCreateContent,
  createSheetClassName,
  createSheetId,
  createSheetDefaultWidth = 560,
  createSheetMinWidth = 420,
  createSheetMaxWidth = 920,
  disableCreateSheetResize = false,
}: EntityPickerProps<TOption, TFieldValues>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<TOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingMoreOptions, setIsLoadingMoreOptions] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialSelectedLabel);
  // A última opção escolhida: a lista remota é trocada a cada busca, e o campo
  // continua precisando do rótulo e do avatar dela.
  const [lastSelectedOption, setLastSelectedOption] = useState<TOption | null>(
    null
  );
  const [visibleCount, setVisibleCount] = useState(visibleCountStep);
  const parentScrollContainerRef = useRef<HTMLElement | null>(null);
  const parentScrollTopRef = useRef(0);
  const requestIdRef = useRef(0);
  const openAutoLoadKeyRef = useRef<string | null>(null);
  const loadOptionsRef = useRef(loadOptions);
  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  });

  const resolvedEmptyLabel = emptyLabel ?? placeholder;
  const resolvedSearchPlaceholder = searchPlaceholder ?? placeholder;
  const resolvedCreateActionLabel =
    createActionLabel ?? (entityLabel ? `Criar ${entityLabel}` : 'Criar novo');
  const resolvedEditActionLabel =
    editActionLabel ?? (entityLabel ? `Editar ${entityLabel}` : 'Editar');
  const canCreate =
    showCreateButton &&
    Boolean(onCreate || renderCreateContent || onCreateClick);
  const resolvedCreateTitle =
    createTitle ?? (entityLabel ? `Criar ${entityLabel}` : 'Criar novo item');
  const resolvedCreateDescription =
    createDescription ??
    (entityLabel
      ? `Cadastre um novo ${entityLabel} para usar neste campo.`
      : 'Cadastre um novo item para usar neste campo.');

  const resolvedCreateSheetId = useMemo(() => {
    if (createSheetId) {
      return createSheetId;
    }

    const fallbackIdSource =
      (typeof name === 'string' && name) ||
      entityLabel ||
      placeholder ||
      'entity';

    const normalizedId = fallbackIdSource
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return `entity-picker:create:${normalizedId || 'entity'}`;
  }, [createSheetId, entityLabel, name, placeholder]);

  const optionValueResolver = useCallback(
    (option: TOption) => {
      if (getOptionValue) {
        return getOptionValue(option);
      }

      const knownOption = option as Partial<EntityPickerKnownFields>;

      return (knownOption.id ?? getNestedValue(option, 'id')) as
        | string
        | number
        | null
        | undefined;
    },
    [getOptionValue]
  );

  const optionLabelResolver = useCallback(
    (option: TOption) => {
      if (getOptionLabel) {
        return getOptionLabel(option);
      }

      const knownOption = option as Partial<EntityPickerKnownFields>;
      const fallback =
        knownOption.label ??
        knownOption.name ??
        knownOption.title ??
        knownOption.description ??
        optionValueResolver(option);

      return String(fallback ?? '');
    },
    [getOptionLabel, optionValueResolver]
  );

  const optionDescriptionResolver = useCallback(
    (option: TOption) => {
      if (getOptionDescription) {
        return getOptionDescription(option);
      }

      const knownOption = option as Partial<EntityPickerKnownFields>;
      const code = knownOption.code;
      const description = knownOption.description;
      const extra = [code, description].filter(Boolean).join(' • ');

      return extra || undefined;
    },
    [getOptionDescription]
  );

  const optionSearchTextResolver = useCallback(
    (option: TOption) => {
      if (getOptionSearchText) {
        return getOptionSearchText(option);
      }

      return [optionLabelResolver(option), optionDescriptionResolver(option)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    },
    [getOptionSearchText, optionDescriptionResolver, optionLabelResolver]
  );

  const optionKeyResolver = useCallback(
    (option: TOption) => {
      const rawValue = optionValueResolver(option);

      if (rawValue !== undefined && rawValue !== null && String(rawValue)) {
        return String(rawValue);
      }

      return optionLabelResolver(option).trim().toLowerCase();
    },
    [optionLabelResolver, optionValueResolver]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [debounceMs, search]);

  useEffect(() => {
    setSelectedLabel(initialSelectedLabel);
  }, [initialSelectedLabel]);

  const loadRemoteOptions = useCallback(
    async (page: number, searchTerm: string, reset: boolean) => {
      // Defensive guard: every caller of loadRemoteOptions (the
      // debounced-search effect, the refreshToken effect, the open-on-mount
      // effect, and the "load more" click handler) already checks
      // `loadOptionsRef.current`/`loadOptions` truthy synchronously right
      // before calling this function, so this duplicate check can never
      // observe a falsy ref in practice.
      /* v8 ignore next 3 */
      if (!loadOptionsRef.current) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (reset) {
        setIsLoadingOptions(true);
      } else {
        setIsLoadingMoreOptions(true);
      }

      try {
        const result = normalizeLoadResult(
          await loadOptionsRef.current({
            page,
            pageSize,
            search: searchTerm,
          })
        );

        if (requestIdRef.current !== requestId) {
          return;
        }

        setCurrentPage(page);
        setHasMore(Boolean(result.hasMore));
        setRemoteTotal(result.total ?? null);
        setRemoteOptions((current) =>
          reset
            ? result.items
            : mergeUniqueOptions(current, result.items, optionKeyResolver)
        );
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        console.error('Failed to load entity picker options.', error);
        setHasMore(false);
        if (reset) {
          setRemoteOptions([]);
          setRemoteTotal(null);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoadingOptions(false);
          setIsLoadingMoreOptions(false);
        }
      }
    },
    [optionKeyResolver, pageSize]
  );

  useEffect(() => {
    if (!loadOptionsRef.current) {
      return;
    }

    void loadRemoteOptions(1, debouncedSearch, true);
  }, [debouncedSearch, loadRemoteOptions]);

  useEffect(() => {
    if (!loadOptionsRef.current || refreshToken === undefined) {
      return;
    }

    void loadRemoteOptions(1, debouncedSearch, true);
  }, [debouncedSearch, loadRemoteOptions, refreshToken]);

  useEffect(() => {
    if (!open) {
      openAutoLoadKeyRef.current = null;
      return;
    }

    if (!open || !loadOptionsRef.current || isLoadingOptions) {
      return;
    }

    if (remoteOptions.length > 0) {
      return;
    }

    const autoLoadKey = debouncedSearch.trim();
    if (openAutoLoadKeyRef.current === autoLoadKey) {
      return;
    }

    openAutoLoadKeyRef.current = autoLoadKey;

    void loadRemoteOptions(1, debouncedSearch, true);
  }, [
    debouncedSearch,
    isLoadingOptions,
    loadRemoteOptions,
    open,
    remoteOptions.length,
  ]);

  const initializeCreateValues = (prefill = '') => {
    const nextValues = Object.fromEntries(
      createFields.map((field) => [field.name, field.defaultValue ?? ''])
    );

    const mappedValues = mapSearchToCreateValues?.(prefill) ?? {};

    Object.assign(nextValues, mappedValues);

    if (prefill && createFields[0] && !mappedValues[createFields[0].name]) {
      nextValues[createFields[0].name] = prefill;
    }

    return nextValues;
  };

  const openCreateSheet = (prefill = '') => {
    if (onCreateClick) {
      setOpen(false);
      onCreateClick(prefill);
      return;
    }
    setCreateValues(initializeCreateValues(prefill));
    setOpen(false);
    setCreateOpen(true);
  };

  const captureParentScrollPosition = (trigger: HTMLElement) => {
    const parentSheetContent = trigger.closest(
      '[data-radix-dialog-content]'
    ) as HTMLElement | null;

    if (!parentSheetContent) {
      parentScrollContainerRef.current = null;
      parentScrollTopRef.current = 0;
      return;
    }

    parentScrollContainerRef.current = parentSheetContent;
    parentScrollTopRef.current = parentSheetContent.scrollTop;
  };

  const restoreParentScrollPosition = () => {
    const fallbackOpenDialog = (
      Array.from(
        document.querySelectorAll(
          '[data-radix-dialog-content][data-state="open"]'
        )
      ) as HTMLElement[]
    ).at(-1);

    const container =
      parentScrollContainerRef.current &&
      document.body.contains(parentScrollContainerRef.current)
        ? parentScrollContainerRef.current
        : fallbackOpenDialog || null;

    if (!container) {
      return;
    }

    const restore = () => {
      container.scrollTop = parentScrollTopRef.current;
    };

    requestAnimationFrame(restore);
    setTimeout(restore, 0);
    setTimeout(restore, 120);
  };

  const knownOptions = useMemo(
    () => mergeUniqueOptions(options, remoteOptions, optionKeyResolver),
    [optionKeyResolver, options, remoteOptions]
  );

  const locallyFilteredOptions = useMemo(() => {
    const normalizedSearch = normalizeSearchText(debouncedSearch.trim());

    if (!normalizedSearch) {
      return knownOptions;
    }

    return knownOptions.filter((option) =>
      normalizeSearchText(optionSearchTextResolver(option)).includes(
        normalizedSearch
      )
    );
  }, [debouncedSearch, knownOptions, optionSearchTextResolver]);

  const filteredOptions = useMemo(() => {
    if (loadOptions) {
      return debouncedSearch.trim()
        ? remoteOptions
        : mergeUniqueOptions(options, remoteOptions, optionKeyResolver);
    }

    return locallyFilteredOptions;
  }, [
    debouncedSearch,
    loadOptions,
    locallyFilteredOptions,
    optionKeyResolver,
    options,
    remoteOptions,
  ]);

  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, visibleCount),
    [filteredOptions, visibleCount]
  );

  // Only meaningful when loadOptions supplies `total` — drives the real Prev/Next paginated
  // footer in variant="inline" instead of the "load more" button.
  const totalPages =
    loadOptions && remoteTotal != null
      ? Math.max(1, Math.ceil(remoteTotal / pageSize))
      : null;

  const setCreateFieldValue = (fieldName: string, nextValue: string) => {
    setCreateValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  };

  const parseFieldValue = (rawValue: string | number | null | undefined) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return valueType === 'number' ? null : '';
    }

    return valueType === 'number' ? Number(rawValue) : String(rawValue);
  };

  const applyValueChange = (
    nextValue: EntityPickerValue,
    option: TOption | null
  ) => {
    const parsedValue = parseFieldValue(nextValue);

    onChange?.(parsedValue, option);
  };

  const handleCreate = async () => {
    if (!onCreate || isCreating) {
      return;
    }

    const hasInvalidRequiredField = createFields.some(
      (field) => field.required && !createValues[field.name]?.trim()
    );

    if (hasInvalidRequiredField) {
      return;
    }

    setIsCreating(true);

    try {
      const created = await onCreate(createValues);

      if (!created) {
        return;
      }

      setRemoteOptions((current) =>
        mergeUniqueOptions([created], current, optionKeyResolver)
      );

      const nextValue = optionValueResolver(created) ?? null;
      applyValueChange(nextValue, created);
      setLastSelectedOption(created);
      setSelectedLabel(optionLabelResolver(created));
      setSearch(optionLabelResolver(created));
      setCreateOpen(false);
      setOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const createContext: EntityPickerCreateContext<TOption> = {
    values: createValues,
    setValue: setCreateFieldValue,
    isCreating,
    closeCreate: () => setCreateOpen(false),
    submitCreate: handleCreate,
    selectCreated: (option) => {
      setRemoteOptions((current) =>
        mergeUniqueOptions([option], current, optionKeyResolver)
      );

      const nextValue = optionValueResolver(option) ?? null;
      applyValueChange(nextValue, option);
      setLastSelectedOption(option);
      setSelectedLabel(optionLabelResolver(option));
      setSearch(optionLabelResolver(option));
      setCreateOpen(false);
      setOpen(false);
    },
    search,
    setSearch,
  };

  const renderPicker = (
    currentRawValue: unknown,
    setCurrentValue: (
      nextValue: EntityPickerValue,
      option: TOption | null
    ) => void,
    currentErrorMessage?: string
  ) => {
    const normalizedValue =
      currentRawValue !== undefined &&
      currentRawValue !== null &&
      String(currentRawValue).length > 0
        ? String(currentRawValue)
        : '';

    const hasValue = normalizedValue.length > 0;
    const selectedOption =
      knownOptions.find(
        (option) => String(optionValueResolver(option)) === normalizedValue
      ) ??
      (lastSelectedOption &&
      String(optionValueResolver(lastSelectedOption)) === normalizedValue
        ? lastSelectedOption
        : null);

    const resolvedSelectedLabel = selectedOption
      ? optionLabelResolver(selectedOption)
      : selectedLabel;

    const fallbackLabel = hasValue
      ? resolvedSelectedLabel || `ID #${normalizedValue}`
      : resolvedSelectedLabel || resolvedEmptyLabel;

    const displayLabel = selectedOption
      ? optionLabelResolver(selectedOption)
      : fallbackLabel;

    const selectedAvatar =
      getOptionAvatar && hasValue
        ? selectedOption
          ? getOptionAvatar(selectedOption)
          : (initialSelectedAvatar ?? { fallback: displayLabel })
        : null;

    const displayValue = renderSelectedValue ? (
      renderSelectedValue({
        option: selectedOption,
        value: normalizedValue,
        label: displayLabel,
      })
    ) : selectedAvatar ? (
      <span className="flex min-w-0 items-center gap-2">
        <EntityPickerAvatarView
          avatar={selectedAvatar}
          label={displayLabel}
          shape={avatarShape}
          className="size-5"
        />
        <span className="truncate">{displayLabel}</span>
      </span>
    ) : (
      displayLabel
    );

    const shouldShowClear = clearable && hasValue;

    // Melhorar o Picker de alunos: modo alternativo sem popover, onde a lista paginada fica
    // sempre visível (não escondida atrás de um clique) e o campo de busca ocupa a largura
    // total — usado por FacetedMultiPicker, que já mantém sua própria seção de "selecionados"
    // separada da lista de resultados. O modo padrão ('popover') permanece intocado para todo o
    // resto dos usos (single-select combobox).
    // Com fillHeight o scroll desce um nível: o CommandList vira só um container
    // flex de altura livre e quem rola é o CommandGroup, de modo que o rodapé de
    // paginação (irmão do grupo) fique fixo no pé da lista em vez de só aparecer
    // depois de rolar até o fim.
    const stretchList = variant === 'inline' && fillHeight;

    // Rodapé da lista (paginação real ou "carregar mais"). Em modo fillHeight ele é
    // renderizado fora do CommandList (ver o retorno de variant="inline" abaixo), como
    // irmão do quadro da lista — assim ele nunca fica escondido atrás do scroll interno
    // da lista, não importa a altura que ela acabe tendo.
    const listFooter =
      variant === 'inline' && totalPages != null ? (
        <div className="border-t p-2">
          <Pagination>
            <PaginationContent className="flex-wrap justify-center gap-1">
              <PaginationItem>
                <PaginationLink
                  href="#"
                  size="icon"
                  aria-label="Página anterior"
                  className={cn(
                    'size-7',
                    (currentPage <= 1 || isLoadingOptions) &&
                      'pointer-events-none opacity-50'
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage > 1) {
                      void loadRemoteOptions(
                        currentPage - 1,
                        debouncedSearch,
                        true
                      );
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>

              {buildPageRange(currentPage, totalPages).map((item, index) =>
                item === '…' ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      size="icon"
                      isActive={item === currentPage}
                      className="size-7"
                      onClick={(event) => {
                        event.preventDefault();
                        if (item !== currentPage) {
                          void loadRemoteOptions(item, debouncedSearch, true);
                        }
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationLink
                  href="#"
                  size="icon"
                  aria-label="Próxima página"
                  className={cn(
                    'size-7',
                    (currentPage >= totalPages || isLoadingOptions) &&
                      'pointer-events-none opacity-50'
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage < totalPages) {
                      void loadRemoteOptions(
                        currentPage + 1,
                        debouncedSearch,
                        true
                      );
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : filteredOptions.length > visibleCount || hasMore ? (
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isLoadingOptions || isLoadingMoreOptions}
            onClick={() => {
              if (loadOptions && hasMore) {
                void loadRemoteOptions(currentPage + 1, debouncedSearch, false);
                return;
              }

              setVisibleCount((current) => current + visibleCountStep);
            }}
          >
            {isLoadingOptions || isLoadingMoreOptions
              ? `${loadMoreLabel}...`
              : loadMoreLabel}
          </Button>
        </div>
      ) : null;

    const commandContent = (
      <Command
        shouldFilter={false}
        className={cn(stretchList && 'flex min-h-0 flex-1 flex-col')}
      >
        {searchable ? (
          <CommandInput
            placeholder={resolvedSearchPlaceholder}
            value={search}
            onValueChange={(nextValue) => {
              setSearch(nextValue);
              setVisibleCount(visibleCountStep);
            }}
            className="w-full"
          />
        ) : null}
        {renderListHeader
          ? renderListHeader({
              visibleOptions,
              total: remoteTotal,
              search: debouncedSearch,
            })
          : null}
        <CommandList
          onWheel={(event) => event.stopPropagation()}
          className={cn(
            stretchList &&
              'flex max-h-none min-h-0 flex-1 flex-col overflow-y-hidden'
          )}
        >
          <CommandEmpty>
            {isLoadingOptions ? (
              // Busca remota (diretório do Entra, listagem paginada) leva o
              // suficiente para o texto sozinho parecer tela travada.
              <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin" />
                {loadingLabel}
              </div>
            ) : (
              <div className="space-y-2 p-2 text-center">
                <p className="text-sm text-muted-foreground">
                  {emptyStateDescription || noResultsLabel}
                </p>
                {canCreate ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={(event) => {
                      captureParentScrollPosition(event.currentTarget);
                      openCreateSheet(search.trim());
                    }}
                  >
                    {resolvedCreateActionLabel}
                  </Button>
                ) : null}
              </div>
            )}
          </CommandEmpty>

          <CommandGroup
            className={cn(
              // Teto fixo (em vez de só flex-1): garante que a lista pare de crescer
              // numa altura previsível e sempre sobre espaço pro rodapé de paginação
              // logo abaixo, independente de quanto espaço os ancestrais derem a ela.
              stretchList && 'min-h-0 max-h-[26rem] flex-1 overflow-y-auto'
            )}
          >
            {allowEmptySelection ? (
              <CommandItem
                value="__empty__"
                onSelect={() => {
                  setCurrentValue(valueType === 'number' ? null : '', null);
                  setSelectedLabel('');
                  setSearch('');
                  setOpen(false);
                }}
              >
                {emptySelectionLabel ?? resolvedEmptyLabel}
              </CommandItem>
            ) : null}

            {visibleOptions.map((option, index) => {
              const optionValue = optionValueResolver(option);
              const isSelected = String(optionValue) === normalizedValue;
              const optionDisabled = isOptionDisabled?.(option) ?? false;
              // cmdk identifica cada item pelo `value` (não pela `key` do React). Usar o
              // texto de busca causava colisão entre opções de rótulo idêntico e `id`
              // diferente, fazendo o cmdk destacar todas juntas. Uma identidade única (id +
              // índice) garante destaque/seleção próprios.
              const optionIdentity = `${optionKeyResolver(option)}-${index}`;
              const optionAvatar = getOptionAvatar?.(option);

              return (
                <CommandItem
                  key={optionIdentity}
                  value={optionIdentity}
                  disabled={optionDisabled}
                  onSelect={() => {
                    // Defensive guard: cmdk's CommandItem (see command.tsx) already
                    // refuses to invoke `onSelect` at all when `disabled` is set (verified
                    // by the "não seleciona opção desabilitada" test below, which never
                    // reaches this closure for a disabled item), so this early return
                    // can't be exercised through any user interaction with the real cmdk
                    // library.
                    /* v8 ignore next 3 */
                    if (optionDisabled) {
                      return;
                    }
                    setCurrentValue(optionValue ?? null, option);
                    setLastSelectedOption(option);
                    if (closeOnSelect) {
                      setSelectedLabel(optionLabelResolver(option));
                      setSearch(optionLabelResolver(option));
                      setOpen(false);
                    }
                  }}
                >
                  {renderOption ? (
                    renderOption({
                      option,
                      isSelected,
                      isDisabled: optionDisabled,
                    })
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      {optionAvatar ? (
                        <EntityPickerAvatarView
                          avatar={optionAvatar}
                          label={optionLabelResolver(option)}
                          shape={avatarShape}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          title={optionLabelResolver(option)}
                        >
                          {optionLabelResolver(option)}
                        </div>
                        {optionDescriptionResolver(option) ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {optionDescriptionResolver(option)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>

          {/* Em stretchList o rodapé é renderizado fora do CommandList (ver
              variant="inline" abaixo) — aqui só aparece pros outros modos
              (popover, ou inline sem fillHeight), que não tinham o problema. */}
          {!stretchList ? listFooter : null}
        </CommandList>
      </Command>
    );

    if (variant === 'inline') {
      return (
        <div
          className={cn(
            stretchList ? 'flex min-h-0 flex-1 flex-col gap-2' : 'grid gap-2',
            className
          )}
        >
          {label ? (
            <Label
              data-error={Boolean(currentErrorMessage)}
              className="data-[error=true]:text-destructive"
            >
              {label}
            </Label>
          ) : null}

          <div
            className={cn(
              'flex w-full min-w-0 flex-col rounded-md border',
              stretchList && 'min-h-0 flex-1',
              buttonClassName
            )}
          >
            {/* Só este quadro interno recorta (overflow-hidden) — a lista fica limitada
                à sua própria altura (ver CommandGroup acima), então o rodapé abaixo dele
                nunca corre risco de ser cortado junto, mesmo que o quadro externo receba
                menos altura do que o esperado de algum ancestral. */}
            <div
              className={cn(
                'min-w-0',
                stretchList && 'flex min-h-0 flex-1 flex-col overflow-hidden'
              )}
            >
              {commandContent}
            </div>
            {stretchList ? listFooter : null}
          </div>

          {currentErrorMessage ? (
            <p className="text-destructive text-sm">{currentErrorMessage}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className={cn('grid gap-2', className)}>
        {label ? (
          <Label
            data-error={Boolean(currentErrorMessage)}
            className="data-[error=true]:text-destructive"
          >
            {label}
          </Label>
        ) : null}

        <div className="flex w-full min-w-0 items-center gap-2">
          <Popover
            open={!disabled && open}
            onOpenChange={(nextOpen) => {
              if (!disabled) {
                setOpen(nextOpen);

                if (!nextOpen) {
                  setVisibleCount(visibleCountStep);
                }
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                disabled={disabled || isCreating}
                className={cn(
                  'h-10 min-w-0 flex-1 justify-between overflow-hidden',
                  buttonClassName
                )}
              >
                <span
                  className="min-w-0 flex-1 truncate text-left"
                  title={
                    typeof displayValue === 'string' ? displayValue : undefined
                  }
                >
                  {displayValue}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            {/* A lista parte da largura do botão, mas cresce até caber o rótulo
                inteiro (plano de contas tem nomes longos); o teto evita que ela
                saia da tela. */}
            <PopoverContent
              align="start"
              className="p-0"
              style={{
                minWidth: 'var(--radix-popover-trigger-width)',
                width: 'max-content',
                maxWidth: 'min(32rem, calc(100vw - 2rem))',
              }}
            >
              {commandContent}
            </PopoverContent>
          </Popover>

          {shouldShowClear ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={disabled || isCreating}
              onClick={() => {
                setCurrentValue(valueType === 'number' ? null : '', null);
                setSearch('');
                setSelectedLabel('');
                setVisibleCount(visibleCountStep);
                setOpen(false);
              }}
              tooltip={cancelLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}

          {onEditSelection && hasValue ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={disabled || isCreating}
              onClick={() => {
                setOpen(false);
                onEditSelection(
                  parseFieldValue(normalizedValue) as string | number,
                  selectedOption
                );
              }}
              tooltip={resolvedEditActionLabel}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}

          {canCreate ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={disabled}
              loading={isCreating}
              onClick={(event) => {
                captureParentScrollPosition(event.currentTarget);
                openCreateSheet(
                  search.trim() || normalizedValue || selectedLabel
                );
              }}
              tooltip={resolvedCreateActionLabel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {currentErrorMessage ? (
          <p className="text-destructive text-sm">{currentErrorMessage}</p>
        ) : null}
      </div>
    );
  };

  const createFieldsContent = createFields.length ? (
    <div className="mt-6 space-y-4">
      {createFields.map((field) => {
        // `InputMoney` é um <input> com máscara: as mesmas props servem aos dois,
        // só o `type` é exclusivo do Input cru.
        const inputProps = {
          value: createValues[field.name] ?? '',
          placeholder: field.placeholder ?? createPlaceholder ?? field.label,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            setCreateFieldValue(field.name, event.target.value),
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleCreate();
            }
          },
        };

        return (
          <div key={field.name} className="space-y-2">
            <Label>{field.label}</Label>
            {field.type === 'money' ? (
              <InputMoney {...inputProps} />
            ) : (
              <Input type={field.type ?? 'text'} {...inputProps} />
            )}
          </div>
        );
      })}

      {onCreate ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={isCreating}
            onClick={() => void handleCreate()}
          >
            {saveLabel}
          </Button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {form && name ? (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => {
            const fieldState = form.getFieldState(name, form.formState);

            return renderPicker(
              field.value,
              (nextValue, option) => {
                const parsedValue = parseFieldValue(nextValue);
                field.onChange(parsedValue);
                onChange?.(parsedValue, option);
              },
              fieldState.error?.message ?? errorMessage
            );
          }}
        />
      ) : (
        renderPicker(
          value,
          (nextValue, option) => applyValueChange(nextValue, option),
          errorMessage
        )
      )}

      <Sheet
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);

          if (!nextOpen) {
            setCreateValues({});
            restoreParentScrollPosition();
          }
        }}
      >
        <ResizableSheetContent
          sheetId={resolvedCreateSheetId}
          defaultWidth={createSheetDefaultWidth}
          minWidth={createSheetMinWidth}
          maxWidth={createSheetMaxWidth}
          enableResize={!disableCreateSheetResize}
          className={cn(
            'w-full overflow-y-auto px-2 sm:max-w-md',
            createSheetClassName
          )}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>{resolvedCreateTitle}</SheetTitle>
            <SheetDescription>{resolvedCreateDescription}</SheetDescription>
          </SheetHeader>

          <div className="px-2">
            {renderCreateContent
              ? renderCreateContent(createContext)
              : createFieldsContent}
          </div>
        </ResizableSheetContent>
      </Sheet>
    </>
  );
}

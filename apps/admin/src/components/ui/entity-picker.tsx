'use client';

import { ChevronsUpDown, Plus, X } from 'lucide-react';
import {
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
import { Label } from '@/components/ui/label';
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
  type?: 'text' | 'email' | 'password' | 'number';
  required?: boolean;
  defaultValue?: string;
};

export type EntityPickerLoadResult<TOption> = {
  items: TOption[];
  hasMore?: boolean;
};

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
  onCreate?: (
    values: Record<string, string>
  ) => Promise<TOption | null | void> | TOption | null | void;
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

function normalizeLoadResult<TOption extends object>(
  payload: EntityPickerLoadResult<TOption> | TOption[]
) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      hasMore: false,
    };
  }

  return {
    items: payload.items ?? [],
    hasMore: payload.hasMore ?? false,
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
  renderOption,
  renderSelectedValue,
  isOptionDisabled,
  onCreate,
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
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingMoreOptions, setIsLoadingMoreOptions] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialSelectedLabel);
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
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return knownOptions;
    }

    return knownOptions.filter((option) =>
      optionSearchTextResolver(option).includes(normalizedSearch)
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
      ) ?? null;

    const resolvedSelectedLabel = selectedOption
      ? optionLabelResolver(selectedOption)
      : selectedLabel;

    const fallbackLabel = hasValue
      ? resolvedSelectedLabel || `ID #${normalizedValue}`
      : resolvedSelectedLabel || resolvedEmptyLabel;

    const displayLabel = selectedOption
      ? optionLabelResolver(selectedOption)
      : fallbackLabel;

    const displayValue = renderSelectedValue
      ? renderSelectedValue({
          option: selectedOption,
          value: normalizedValue,
          label: displayLabel,
        })
      : displayLabel;

    const shouldShowClear = clearable && hasValue;

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
                <span className="min-w-0 flex-1 truncate text-left">
                  {displayValue}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              style={{ width: 'var(--radix-popover-trigger-width)' }}
            >
              <Command shouldFilter={false}>
                {searchable ? (
                  <CommandInput
                    placeholder={resolvedSearchPlaceholder}
                    value={search}
                    onValueChange={(nextValue) => {
                      setSearch(nextValue);
                      setVisibleCount(visibleCountStep);
                    }}
                  />
                ) : null}
                <CommandList onWheel={(event) => event.stopPropagation()}>
                  <CommandEmpty>
                    {isLoadingOptions ? (
                      loadingLabel
                    ) : (
                      <div className="space-y-2 p-2 text-center">
                        <p className="text-sm text-muted-foreground">
                          {emptyStateDescription || noResultsLabel}
                        </p>
                        {showCreateButton &&
                        (onCreate || renderCreateContent) ? (
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

                  <CommandGroup>
                    {allowEmptySelection ? (
                      <CommandItem
                        value="__empty__"
                        onSelect={() => {
                          setCurrentValue(
                            valueType === 'number' ? null : '',
                            null
                          );
                          setSelectedLabel('');
                          setSearch('');
                          setOpen(false);
                        }}
                      >
                        {emptySelectionLabel ?? resolvedEmptyLabel}
                      </CommandItem>
                    ) : null}

                    {visibleOptions.map((option) => {
                      const optionValue = optionValueResolver(option);
                      const isSelected =
                        String(optionValue) === normalizedValue;
                      const optionDisabled =
                        isOptionDisabled?.(option) ?? false;

                      return (
                        <CommandItem
                          key={optionKeyResolver(option)}
                          value={optionSearchTextResolver(option)}
                          disabled={optionDisabled}
                          onSelect={() => {
                            // Defensive guard: cmdk's CommandItem (see
                            // command.tsx) already refuses to invoke
                            // `onSelect` at all when `disabled` is set
                            // (verified by the "não seleciona opção
                            // desabilitada" test below, which never reaches
                            // this closure for a disabled item), so this
                            // early return can't be exercised through any
                            // user interaction with the real cmdk library.
                            /* v8 ignore next 3 */
                            if (optionDisabled) {
                              return;
                            }
                            setCurrentValue(optionValue ?? null, option);
                            setSelectedLabel(optionLabelResolver(option));
                            setSearch(optionLabelResolver(option));
                            setOpen(false);
                          }}
                        >
                          {renderOption ? (
                            renderOption({
                              option,
                              isSelected,
                              isDisabled: optionDisabled,
                            })
                          ) : (
                            <div className="min-w-0">
                              <div className="truncate">
                                {optionLabelResolver(option)}
                              </div>
                              {optionDescriptionResolver(option) ? (
                                <div className="truncate text-xs text-muted-foreground">
                                  {optionDescriptionResolver(option)}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>

                  {filteredOptions.length > visibleCount || hasMore ? (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        disabled={isLoadingOptions || isLoadingMoreOptions}
                        onClick={() => {
                          if (loadOptions && hasMore) {
                            void loadRemoteOptions(
                              currentPage + 1,
                              debouncedSearch,
                              false
                            );
                            return;
                          }

                          setVisibleCount(
                            (current) => current + visibleCountStep
                          );
                        }}
                      >
                        {isLoadingOptions || isLoadingMoreOptions
                          ? `${loadMoreLabel}...`
                          : loadMoreLabel}
                      </Button>
                    </div>
                  ) : null}
                </CommandList>
              </Command>
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
              aria-label={cancelLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}

          {showCreateButton && (onCreate || renderCreateContent) ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={disabled || isCreating}
              onClick={(event) => {
                captureParentScrollPosition(event.currentTarget);
                openCreateSheet(
                  search.trim() || normalizedValue || selectedLabel
                );
              }}
              aria-label={resolvedCreateActionLabel}
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
      {createFields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label>{field.label}</Label>
          <Input
            type={field.type ?? 'text'}
            value={createValues[field.name] ?? ''}
            placeholder={field.placeholder ?? createPlaceholder ?? field.label}
            onChange={(event) =>
              setCreateFieldValue(field.name, event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
        </div>
      ))}

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

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, type ReactNode } from 'react';

export type FilterOption = {
  label: string;
  value: string;
};

type SearchBarControlBase = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export type SearchBarSelectControl = SearchBarControlBase & {
  type: 'select';
  options: FilterOption[];
};

export type SearchBarDateControl = SearchBarControlBase & {
  type: 'date';
  min?: string;
  max?: string;
  label?: string;
};

/**
 * Escape hatch for a facet the bar has no primitive for — a tag popover, a
 * key/value pair. Keeps such filters on the same row as the selects instead of
 * pushing the page to build a second filter bar.
 */
export type SearchBarCustomControl = {
  id: string;
  type: 'custom';
  render: () => ReactNode;
};

export type SearchBarControl =
  | SearchBarSelectControl
  | SearchBarDateControl
  | SearchBarCustomControl;

export type SearchBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  filters?: {
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    placeholder?: string;
  };
  controls?: SearchBarControl[];
  afterSearchButton?: ReactNode;
  actions?: ReactNode;
  showSearchButton?: boolean;
  /** Busca em andamento: o botão "Buscar" mostra o carregando. */
  searchLoading?: boolean;
  debounceMs?: number;
  className?: string;
  /**
   * Classes do grupo de filtros. Por padrão o grupo desce inteiro para a linha
   * de baixo quando não cabe ao lado da busca; `sm:flex-1 sm:min-w-0` faz os
   * filtros seguirem na mesma linha e quebrarem um a um.
   */
  controlsClassName?: string;
};

function renderControl(control: SearchBarControl, filterPlaceholder: string) {
  if (control.type === 'custom') {
    return control.render();
  }

  if (control.type === 'date') {
    if (control.label) {
      return (
        <div className="flex w-full items-center gap-1.5 rounded-md border border-input bg-background px-2.5 shadow-xs sm:w-auto">
          <span className="select-none whitespace-nowrap text-xs font-medium text-muted-foreground">
            {control.label}
          </span>
          <input
            type="date"
            value={control.value}
            onChange={(event) => control.onChange(event.target.value)}
            min={control.min}
            max={control.max}
            className={cn(
              'min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none sm:w-30 sm:flex-none',
              control.className
            )}
          />
        </div>
      );
    }
    return (
      <Input
        type="date"
        value={control.value}
        onChange={(event) => control.onChange(event.target.value)}
        min={control.min}
        max={control.max}
        className={cn('w-full sm:w-44 lg:w-45', control.className)}
      />
    );
  }

  return (
    <Select
      value={control.value}
      onValueChange={control.onChange}
      disabled={control.disabled}
    >
      <SelectTrigger className={cn('w-full sm:w-44 lg:w-45', control.className)}>
        <SelectValue placeholder={control.placeholder || filterPlaceholder} />
      </SelectTrigger>
      <SelectContent side="bottom">
        {control.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  onSearch = () => {},
  placeholder = '',
  filters,
  controls = [],
  afterSearchButton,
  actions,
  showSearchButton = true,
  searchLoading = false,
  debounceMs,
  className = '',
  controlsClassName,
}: SearchBarProps) {
  const t = useTranslations('core.SearchBar');
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });
  useEffect(() => {
    if (debounceMs == null) return;
    const timer = setTimeout(() => onSearchRef.current(), debounceMs);
    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch();
  };

  const normalizedControls: SearchBarControl[] = filters
    ? [
        {
          id: 'legacy-filter',
          type: 'select',
          value: filters.value,
          onChange: filters.onChange,
          options: filters.options,
          placeholder: filters.placeholder,
          className: 'sm:w-48',
        },
        ...controls,
      ]
    : controls;

  return (
    <form
      className={cn('flex w-full flex-col gap-2 pb-0', className)}
      onSubmit={handleSubmit}
    >
      <div className="flex w-full flex-wrap items-center gap-2">
        <Input
          className="min-w-0 flex-1 sm:min-w-72 lg:max-w-80"
          placeholder={placeholder || t('searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {showSearchButton && (
          <Button
            variant="default"
            size="icon"
            className="shrink-0 lg:w-auto lg:px-4"
            type="submit"
            loading={searchLoading}
            tooltip={t('btnBuscar')}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:inline">
              {t('btnBuscar')}
            </span>
          </Button>
        )}
        {afterSearchButton ? (
          <div className="shrink-0">{afterSearchButton}</div>
        ) : null}

        {/* No celular os filtros formam uma grade de 2 colunas de largura igual,
            e o último ocupa a linha inteira quando a conta é ímpar: sem isso
            cada um fica com a largura fixa dele e a linha sai desencontrada.
            A partir de `sm` voltam a fluir lado a lado. */}
        {normalizedControls.length > 0 && (
          <div
            className={cn(
              'grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center [&>*:last-child:nth-child(odd)]:col-span-2',
              controlsClassName
            )}
          >
            {normalizedControls.map((control) => (
              <div key={control.id} className="min-w-0 sm:shrink-0">
                {renderControl(control, t('filterPlaceholder'))}
              </div>
            ))}
          </div>
        )}

        {/* `gap-2` porque `actions` costuma receber mais de um controle solto (o
            menu de colunas e o alternador de visualização, por exemplo) e sem
            ele os dois encostam um no outro. Grupo que deve ficar colado —
            `ToggleGroup`, botão segmentado — tem contêiner próprio e não é
            afetado; ação única também não. */}
        {actions && (
          <div className="flex shrink-0 items-center justify-end gap-2 max-sm:w-full sm:ml-auto">
            {actions}
          </div>
        )}
      </div>
    </form>
  );
}

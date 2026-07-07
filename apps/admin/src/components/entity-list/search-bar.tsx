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

export type SearchBarControl = SearchBarSelectControl | SearchBarDateControl;

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
  debounceMs?: number;
  className?: string;
};

function renderControl(control: SearchBarControl, filterPlaceholder: string) {
  if (control.type === 'date') {
    if (control.label) {
      return (
        <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 shadow-xs">
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
              'w-30 bg-transparent py-1.5 text-sm text-foreground outline-none',
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
        className={cn('w-40 sm:w-44 lg:w-45', control.className)}
      />
    );
  }

  return (
    <Select
      value={control.value}
      onValueChange={control.onChange}
      disabled={control.disabled}
    >
      <SelectTrigger className={cn('w-40 sm:w-44 lg:w-45', control.className)}>
        <SelectValue
          placeholder={control.placeholder || filterPlaceholder}
        />
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
  debounceMs,
  className = '',
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
            aria-label={t('btnBuscar')}
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

        {normalizedControls.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {normalizedControls.map((control) => (
              <div key={control.id} className="shrink-0">
                {renderControl(control, t('filterPlaceholder'))}
              </div>
            ))}
          </div>
        )}

        {actions && (
          <div className="flex shrink-0 items-center sm:ml-auto">{actions}</div>
        )}
      </div>
    </form>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ICON_OPTIONS,
  normalizeIconSlug,
  resolveLucideIcon,
} from './lucide-icon';

export type IconPickerProps = {
  /** Nome kebab-case do ícone selecionado, ou null. */
  value: string | null;
  onChange: (slug: string | null) => void;
  searchPlaceholder: string;
  clearLabel: string;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Galeria de ícones lucide com busca. Trabalha sempre com nomes kebab-case,
 * o mesmo formato guardado no banco (`menu.icon`, `vault.icon_slug`).
 */
export function IconPicker({
  value,
  onChange,
  searchPlaceholder,
  clearLabel,
  emptyLabel,
  disabled,
  className,
}: IconPickerProps) {
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const term = normalizeIconSlug(query);
    if (!term) return ICON_OPTIONS;
    return ICON_OPTIONS.filter((name) => name.includes(term));
  }, [query]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
            className="pl-8"
          />
        </div>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            {clearLabel}
          </Button>
        )}
      </div>

      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto pr-1 md:grid-cols-8">
          {options.map((name) => {
            // Referência estável do barrel do lucide; o filtro só devolve nomes válidos.
            const Icon = resolveLucideIcon(name);
            if (!Icon) return null;
            const isSelected = value === name;

            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => onChange(name)}
                className={cn(
                  'flex aspect-square cursor-pointer items-center justify-center rounded-lg border p-2 transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50',
                  isSelected && 'border-primary bg-primary/10 text-primary'
                )}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

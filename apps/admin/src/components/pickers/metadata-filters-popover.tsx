'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Plus, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  MetadataSuggestInput,
  type MetadataSuggestion,
} from './metadata-suggest-input';

export type MetadataFilterEntry = { key: string; value: string };

export type MetadataFiltersPopoverProps = {
  filters: MetadataFilterEntry[];
  onChange: (next: MetadataFilterEntry[]) => void;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  valueLabel: string;
  valuePlaceholder: string;
  hint: string;
  addLabel: string;
  removeLabel: string;
  clearLabel: string;
  /**
   * Catálogo do que já existe: sem `key` devolve as chaves em uso, com `key` os
   * valores daquela chave. Sem a prop, os dois campos seguem como texto puro.
   */
  loadOptions?: (args: {
    key?: string;
    search: string;
  }) => Promise<MetadataSuggestion[]>;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Versão multi-par do filtro de metadados: cada linha é um par chave/valor e as
 * linhas se combinam com AND ("tem esta chave E aquela"). Valor vazio continua
 * significando "tem esta chave". A variante de par único
 * ({@link ./metadata-filter-popover}) segue servindo o CRM, cujo backend só
 * aceita um par.
 */
export function MetadataFiltersPopover({
  filters,
  onChange,
  label,
  keyLabel,
  keyPlaceholder,
  valueLabel,
  valuePlaceholder,
  hint,
  addLabel,
  removeLabel,
  clearLabel,
  loadOptions,
  loadingLabel,
  disabled,
  className,
}: MetadataFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.filter((filter) => filter.key.trim()).length;
  // Uma linha vazia sempre disponível para digitar, sem exigir um clique em
  // "adicionar" antes do primeiro filtro.
  const rows = filters.length > 0 ? filters : [{ key: '', value: '' }];

  const updateRow = (index: number, next: Partial<MetadataFilterEntry>) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...next } : row
      )
    );
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const loadKeyOptions = useCallback(
    (args: { search: string }) =>
      loadOptions
        ? loadOptions({ search: args.search })
        : Promise.resolve([] as MetadataSuggestion[]),
    [loadOptions]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn('gap-1.5', className)}
        >
          <SlidersHorizontal className="size-3.5" />
          {label}
          {activeCount > 0 ? (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 justify-center px-1 text-[10px]"
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {keyLabel} {rows.length > 1 ? `#${index + 1}` : null}
                </Label>
                {rows.length > 1 || row.key || row.value ? (
                  <button
                    type="button"
                    className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => removeRow(index)}
                    aria-label={removeLabel}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-start gap-1.5">
                <MetadataSuggestInput
                  value={row.key}
                  placeholder={keyPlaceholder}
                  loadOptions={loadOptions ? loadKeyOptions : undefined}
                  loadingLabel={loadingLabel}
                  onChange={(next) => updateRow(index, { key: next })}
                />
                <MetadataSuggestInput
                  value={row.value}
                  placeholder={valuePlaceholder}
                  ariaLabel={valueLabel}
                  // Sem chave não há valor que faça sentido sugerir.
                  loadOptions={
                    loadOptions && row.key.trim()
                      ? (args) =>
                          loadOptions({
                            key: row.key.trim(),
                            search: args.search,
                          })
                      : undefined
                  }
                  optionsKey={row.key.trim()}
                  loadingLabel={loadingLabel}
                  align="end"
                  onChange={(next) => updateRow(index, { value: next })}
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer gap-1.5"
          onClick={() => onChange([...rows, { key: '', value: '' }])}
        >
          <Plus className="size-3.5" />
          {addLabel}
        </Button>

        <p className="text-[11px] text-muted-foreground">{hint}</p>

        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange([])}
          >
            {clearLabel}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

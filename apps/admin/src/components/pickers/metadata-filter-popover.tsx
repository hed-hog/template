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
import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  MetadataSuggestInput,
  type MetadataSuggestion,
} from './metadata-suggest-input';

export type MetadataFilterPopoverProps = {
  metadataKey: string;
  metadataValue: string;
  onChange: (next: { key: string; value: string }) => void;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  valueLabel: string;
  valuePlaceholder: string;
  hint: string;
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
 * Filters a list by the free-key metadata a CSV import wrote — the other half
 * of "mark the batch, find it later". An empty value means "has this key".
 */
export function MetadataFilterPopover({
  metadataKey,
  metadataValue,
  onChange,
  label,
  keyLabel,
  keyPlaceholder,
  valueLabel,
  valuePlaceholder,
  hint,
  clearLabel,
  loadOptions,
  loadingLabel,
  disabled,
  className,
}: MetadataFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const isActive = metadataKey.trim().length > 0;
  const trimmedKey = metadataKey.trim();

  const loadKeyOptions = useCallback(
    (args: { search: string }) =>
      loadOptions
        ? loadOptions({ search: args.search })
        : Promise.resolve([] as MetadataSuggestion[]),
    [loadOptions]
  );

  const loadValueOptions = useCallback(
    (args: { search: string }) =>
      loadOptions
        ? loadOptions({ key: trimmedKey, search: args.search })
        : Promise.resolve([] as MetadataSuggestion[]),
    [loadOptions, trimmedKey]
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
          {isActive ? (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 justify-center px-1 text-[10px]"
            >
              1
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label className="text-xs">{keyLabel}</Label>
          <div className="flex">
            <MetadataSuggestInput
              value={metadataKey}
              placeholder={keyPlaceholder}
              loadOptions={loadOptions ? loadKeyOptions : undefined}
              loadingLabel={loadingLabel}
              onChange={(next) => onChange({ key: next, value: metadataValue })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{valueLabel}</Label>
          <div className="flex">
            <MetadataSuggestInput
              value={metadataValue}
              placeholder={valuePlaceholder}
              // Sem chave não há valor que faça sentido sugerir.
              loadOptions={
                loadOptions && trimmedKey ? loadValueOptions : undefined
              }
              optionsKey={trimmedKey}
              loadingLabel={loadingLabel}
              onChange={(next) => onChange({ key: metadataKey, value: next })}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ key: '', value: '' })}
          >
            {clearLabel}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

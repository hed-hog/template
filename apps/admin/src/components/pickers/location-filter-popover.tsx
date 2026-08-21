'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { useState } from 'react';

export type LocationFilterPopoverProps = {
  city: string;
  state: string;
  onChange: (next: { city: string; state: string }) => void;
  label: string;
  cityLabel: string;
  cityPlaceholder: string;
  stateLabel: string;
  statePlaceholder: string;
  clearLabel: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Filtra uma lista pelo endereço da pessoa. `address.city`/`address.state` são
 * varchar livres (sem catálogo de UFs), então ambos são texto com match parcial.
 */
export function LocationFilterPopover({
  city,
  state,
  onChange,
  label,
  cityLabel,
  cityPlaceholder,
  stateLabel,
  statePlaceholder,
  clearLabel,
  disabled,
  className,
}: LocationFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const activeCount = [city.trim(), state.trim()].filter(Boolean).length;

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
          <MapPin className="size-3.5" />
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
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label className="text-xs">{cityLabel}</Label>
          <Input
            value={city}
            placeholder={cityPlaceholder}
            className="h-8 text-xs"
            onChange={(e) => onChange({ city: e.target.value, state })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{stateLabel}</Label>
          <Input
            value={state}
            placeholder={statePlaceholder}
            maxLength={2}
            className="h-8 w-20 text-xs uppercase"
            onChange={(e) =>
              onChange({ city, state: e.target.value.toUpperCase() })
            }
          />
        </div>
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => onChange({ city: '', state: '' })}
          >
            {clearLabel}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Tag as TagIcon } from 'lucide-react';
import { useState } from 'react';

export type TagOption = {
  id: number | string;
  label: string;
  color?: string | null;
};

export type TagFilterPopoverProps = {
  options: TagOption[];
  value: Array<number | string>;
  onChange: (next: Array<number | string>) => void;
  label: string;
  emptyLabel: string;
  clearLabel: string;
  disabled?: boolean;
  className?: string;
};

/**
 * "Has any of these tags" facet, shared by the person/student pickers and the
 * list filters. Renders nothing when there is no tag registered, so a base that
 * does not use tags never shows a dead control.
 */
export function TagFilterPopover({
  options,
  value,
  onChange,
  label,
  emptyLabel,
  clearLabel,
  disabled,
  className,
}: TagFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  if (options.length === 0) return null;

  const toggle = (tagId: number | string) => {
    const key = String(tagId);
    onChange(
      value.some((id) => String(id) === key)
        ? value.filter((id) => String(id) !== key)
        : [...value, tagId]
    );
  };

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
          <TagIcon className="size-3.5" />
          {label}
          {value.length > 0 ? (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 min-w-4 justify-center px-1 text-[10px]"
            >
              {value.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((tag) => {
                const checked = value.some(
                  (id) => String(id) === String(tag.id)
                );
                return (
                  <CommandItem
                    key={String(tag.id)}
                    value={`${tag.label}-${tag.id}`}
                    onSelect={() => toggle(tag.id)}
                  >
                    <Checkbox checked={checked} className="mr-2 shrink-0" />
                    {tag.color ? (
                      <span
                        className="mr-1.5 inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    ) : null}
                    <span className="truncate">{tag.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {value.length > 0 ? (
            <div className="border-t p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChange([])}
              >
                {clearLabel}
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

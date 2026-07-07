'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, List } from 'lucide-react';

export type ViewModeToggleProps = {
  viewMode: 'cards' | 'list';
  onViewModeChange: (viewMode: 'cards' | 'list') => void;
  listLabel: string;
  cardsLabel: string;
};

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  listLabel,
  cardsLabel,
}: ViewModeToggleProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value === 'cards' || value === 'list') {
            onViewModeChange(value);
          }
        }}
        variant="outline"
        size="sm"
        aria-label={`${cardsLabel} / ${listLabel}`}
        className="shrink-0"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="cards"
              aria-label={cardsLabel}
              className="cursor-pointer"
            >
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{cardsLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="list"
              aria-label={listLabel}
              className="cursor-pointer"
            >
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{listLabel}</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}

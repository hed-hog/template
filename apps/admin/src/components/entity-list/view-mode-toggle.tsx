'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, List } from 'lucide-react';
import type { ReactNode } from 'react';

export type ViewModeOption<TMode extends string> = {
  value: TMode;
  label: string;
  icon: ReactNode;
};

export type ViewModeToggleProps<TMode extends string = 'cards' | 'list'> = {
  viewMode: TMode;
  onViewModeChange: (viewMode: TMode) => void;
  /**
   * Visualizações da tela, na ordem dos botões. Sem `modes`, o par padrão
   * cards/lista usa `cardsLabel` e `listLabel`. Tela com calendário, board etc.
   * passa a lista completa, ex.:
   * `[{ value: 'list', label, icon: <List /> }, { value: 'board', label, icon: <KanbanSquare /> }]`.
   */
  modes?: ViewModeOption<TMode>[];
  listLabel?: string;
  cardsLabel?: string;
};

export function ViewModeToggle<TMode extends string = 'cards' | 'list'>({
  viewMode,
  onViewModeChange,
  modes,
  listLabel = '',
  cardsLabel = '',
}: ViewModeToggleProps<TMode>) {
  const options =
    modes ??
    ([
      {
        value: 'cards',
        label: cardsLabel,
        icon: <LayoutGrid className="h-4 w-4" />,
      },
      { value: 'list', label: listLabel, icon: <List className="h-4 w-4" /> },
    ] as ViewModeOption<TMode>[]);

  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          const next = options.find((option) => option.value === value);
          if (next) {
            onViewModeChange(next.value);
          }
        }}
        variant="outline"
        size="sm"
        aria-label={options.map((option) => option.label).join(' / ')}
        className="shrink-0"
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={option.value}
                aria-label={option.label}
                className="cursor-pointer"
              >
                {option.icon}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

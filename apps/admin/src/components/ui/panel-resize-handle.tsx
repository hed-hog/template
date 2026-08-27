'use client';

import { GripVerticalIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import type { PanelResizeSide } from '@/hooks/use-panel-resize';

type PanelResizeHandleProps = {
  /** Lado do painel: define em qual borda a alça fica. */
  side: PanelResizeSide;
  isResizing: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  className?: string;
};

/**
 * Alça de arrasto da borda interna de um painel lateral. Vive fora de
 * `ResizableSheetContent` para que a folha e o painel ancorado usem exatamente
 * a mesma afordância — a mesma linha, o mesmo grip, o mesmo hover atrasado.
 */
export function PanelResizeHandle({
  side,
  isResizing,
  onPointerDown,
  className,
}: PanelResizeHandleProps) {
  return (
    <button
      type="button"
      aria-label="Resize panel"
      className={cn(
        'group absolute top-0 z-10 flex h-full w-3 cursor-ew-resize items-center justify-center',
        side === 'right' ? '-left-1.5' : '-right-1.5',
        className
      )}
      onPointerDown={onPointerDown}
    >
      <span
        className={cn(
          'absolute inset-y-0 w-px transition-colors duration-150',
          isResizing
            ? 'bg-primary'
            : 'bg-border delay-0 group-hover:bg-primary/70 group-hover:delay-150'
        )}
      />
      <span
        className={cn(
          'relative z-10 pointer-events-none rounded-full border p-0.5 shadow-sm transition-colors',
          isResizing
            ? 'border-primary bg-primary/15 text-primary-foreground'
            : 'bg-border/80 text-muted-foreground/70 group-hover:border-primary group-hover:bg-primary/15 group-hover:text-primary-foreground'
        )}
      >
        <GripVerticalIcon className="size-3" />
      </span>
    </button>
  );
}

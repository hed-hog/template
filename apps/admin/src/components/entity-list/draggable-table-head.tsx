'use client';

import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SortableTableHead, type SortableTableHeadProps } from './sortable-table-head';

export type DraggableTableHeadProps = SortableTableHeadProps & {
  /** Id estável da coluna (o mesmo usado em `columnOrder`/`ColumnDef.id`). */
  columnId: string;
  dragDisabled?: boolean;
};

/**
 * `SortableTableHead` com uma alça de arrastar via dnd-kit, para reordenar
 * colunas por drag-and-drop. Precisa estar dentro de um `ColumnDragContext`
 * (ver `column-drag-context.tsx`) para que o `columnId` seja reconhecido.
 */
export function DraggableTableHead({
  columnId,
  dragDisabled,
  style,
  className,
  ...props
}: DraggableTableHeadProps) {
  const t = useTranslations('core.ColumnsMenu');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnId, disabled: dragDisabled });

  return (
    <SortableTableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...style,
      }}
      className={cn(isDragging && 'relative z-10 bg-muted/70', className)}
      dragHandle={
        dragDisabled ? undefined : (
          <span
            {...attributes}
            {...listeners}
            title={t('dragHandle')}
            className="text-muted-foreground/40 hover:text-muted-foreground inline-flex size-4 shrink-0 cursor-grab touch-none items-center active:cursor-grabbing"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </span>
        )
      }
      {...props}
    />
  );
}

'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

export type ColumnDragContextProps = {
  columnOrder: string[];
  onReorder: (nextOrder: string[]) => void;
  children: ReactNode;
};

/**
 * Contexto de drag-and-drop para reordenar cabeçalhos de tabela.
 *
 * Envolve a `<TableRow>` de cabeçalho: cada `DraggableTableHead` dentro dela
 * vira um item arrastável, e soltar sobre outro cabeçalho reordena a lista
 * (persistida por quem chama via `onReorder`, tipicamente `useColumnPreferences`).
 */
export function ColumnDragContext({
  columnOrder,
  onReorder,
  children,
}: ColumnDragContextProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnOrder.indexOf(String(active.id));
    const newIndex = columnOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(columnOrder, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

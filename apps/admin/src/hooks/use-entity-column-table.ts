'use client';

import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
  type RowData,
  type TableOptions,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { useColumnPreferences } from './use-column-preferences';

export type EntityColumnMeta = {
  label: string;
  sortField?: string;
  align?: 'left' | 'right' | 'center';
  /**
   * Esconde o rótulo no cabeçalho, mantendo-o para leitor de tela e para o menu
   * de colunas. Para coluna cujo conteúdo já se explica e o texto só ocupa
   * largura (a de seleção, por exemplo) — não é o mesmo que ficar sem `label`,
   * que apagaria a coluna do menu.
   */
  labelHidden?: boolean;
};

function getColumnId<TData extends RowData>(
  column: ColumnDef<TData>
): string | undefined {
  return column.id ?? (column as { accessorKey?: string }).accessorKey;
}

type UseEntityColumnTableOptions<TData extends RowData> = {
  /** Chave única e estável por tabela, ex. `lms-courses-columns-v1`. */
  storageKey: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  /**
   * Ids que participam do drag/visibilidade. Por padrão, todas as colunas
   * exceto `actions` — a mesma convenção já usada nas páginas do Financeiro:
   * uma coluna de ações não tem rótulo nem dado para ordenar ou ocultar, e
   * fica sempre fixa como última coluna (o `columnOrder` do
   * `@tanstack/react-table` já posiciona depois quem não está na lista).
   */
  columnIds?: string[];
  getRowId?: TableOptions<TData>['getRowId'];
};

/**
 * Junta `useColumnPreferences` (ordem/visibilidade persistidas por usuário) com
 * `useReactTable`, para as páginas de listagem não repetirem esse wiring —
 * ver o padrão original nas páginas do Financeiro (`finance/**\/page.tsx`) e o
 * README de `@/components/entity-list`.
 */
export function useEntityColumnTable<TData extends RowData>({
  storageKey,
  columns,
  data,
  columnIds,
  getRowId,
}: UseEntityColumnTableOptions<TData>) {
  const resolvedColumnIds = useMemo(
    () =>
      columnIds ??
      columns
        .map(getColumnId)
        .filter((id): id is string => !!id && id !== 'actions'),
    [columnIds, columns]
  );

  const columnPrefs = useColumnPreferences({
    storageKey,
    columnIds: resolvedColumnIds,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    state: {
      columnOrder: columnPrefs.order,
      columnVisibility: columnPrefs.visibility,
    },
    onColumnOrderChange: (updater) =>
      columnPrefs.setOrder(
        typeof updater === 'function' ? updater(columnPrefs.order) : updater
      ),
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(columnPrefs.visibility)
          : updater;
      columnPrefs.setHidden(
        resolvedColumnIds.filter((id) => next[id] === false)
      );
    },
  });

  const visibilityMenuColumns = useMemo(
    () =>
      columnPrefs.order.map((id) => ({
        id,
        label:
          (columns.find((column) => getColumnId(column) === id)
            ?.meta as EntityColumnMeta | undefined)?.label ?? id,
      })),
    [columnPrefs.order, columns]
  );

  return {
    table,
    columnPrefs,
    columnIds: resolvedColumnIds,
    visibilityMenuProps: {
      columns: visibilityMenuColumns,
      hidden: columnPrefs.hidden,
      onToggle: columnPrefs.toggleColumn,
      onReset: columnPrefs.reset,
    },
  };
}

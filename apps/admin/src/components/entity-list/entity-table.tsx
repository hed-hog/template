'use client';

import {
  flexRender,
  type Row,
  type Table as ReactTableInstance,
} from '@tanstack/react-table';
import type { ComponentProps, ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EntityColumnMeta } from '@/hooks/use-entity-column-table';
import type { EntityColumnsState } from '@/hooks/use-entity-columns';
import type { TableSortProps } from '@/hooks/use-table-sort';
import { cn } from '@/lib/utils';
import { ColumnDragContext } from './column-drag-context';
import { ColumnsVisibilityMenu } from './columns-visibility-menu';
import { DraggableTableHead } from './draggable-table-head';
import { StickyHorizontalScroll } from './sticky-horizontal-scroll';

type EntityTableTanStackProps<TData, TField extends string = string> = {
  /** Tabela `@tanstack/react-table`, tipicamente de `useEntityColumnTable`. */
  table: ReactTableInstance<TData>;
  /** `order`/`setOrder` de `useColumnPreferences` (ou de `useEntityColumnTable`). */
  columnPrefs: {
    order: string[];
    setOrder: (nextOrder: string[]) => void;
  };
  /**
   * `getSortProps` de `useTableSort`, para colunas cujo `meta.sortField` está
   * definido. `TField` é inferido do `useTableSort` do chamador — o cast
   * interno para `meta.sortField` (sempre um `string` solto) é seguro porque
   * quem declara as colunas e quem declara `sort` é a mesma página.
   */
  getSortProps?: (field: TField) => TableSortProps;
  className?: string;
  rowProps?: (row: Row<TData>) => ComponentProps<typeof TableRow>;
  cellClassName?: (columnId: string) => string | undefined;
  /** Substitui o corpo por linhas de esqueleto (ex.: `<TableBodySkeleton />`) durante o loading. */
  skeleton?: ReactNode;
  items?: never;
  columns?: never;
};

type EntityTableItemsProps<TItem> = {
  /** O que `useEntityColumns` devolve. */
  columns: EntityColumnsState<TItem>;
  items: TItem[];
  getRowKey: (item: TItem) => string | number;
  /** Linha clicável. Combine com `isRowClickable` quando só algumas linhas abrem algo. */
  onRowClick?: (item: TItem) => void;
  /**
   * Abre no duplo clique em vez do clique simples — para listagens onde o
   * clique único já serve a outra coisa (selecionar, marcar) ou onde a
   * navegação acidental atrapalha. Não depende de `onRowClick`: quem passa só
   * este fica com a linha reagindo apenas ao duplo clique, e por isso também
   * ganha o `cursor-pointer`.
   */
  onRowDoubleClick?: (item: TItem) => void;
  isRowClickable?: (item: TItem) => boolean;
  rowClassName?: (item: TItem) => string | undefined;
  /**
   * Escape hatch para o que `onRowClick`/`onRowDoubleClick`/`rowClassName` não
   * cobrem — abrir em nova aba no clique do meio, por exemplo. É aplicado por
   * último, então sobrescreve o que o componente montou para a linha.
   */
  rowProps?: (item: TItem) => ComponentProps<typeof TableRow>;
  /**
   * `false` quando a tela já mostra o menu de colunas em outro lugar (uma barra
   * de filtros própria, por exemplo) com `<ColumnsVisibilityMenu {...columns.menuProps} />`.
   */
  showColumnsMenu?: boolean;
  /** Renderizado no lugar do corpo — para skeleton de carregamento. */
  body?: ReactNode;
  className?: string;
  tableClassName?: string;
  table?: never;
};

export type EntityTableProps<
  TData = unknown,
  TField extends string = string,
> = EntityTableTanStackProps<TData, TField> | EntityTableItemsProps<TData>;

/**
 * Tabela padrão das listagens do admin — duas formas de uso, ambas com
 * cabeçalho arrastável/ordenável, colunas ocultáveis e a escolha do usuário
 * persistida. Ver a seção "EntityTable" do README desta pasta.
 *
 * - `columns`/`items` (via `useEntityColumns`): a tela passa os dados brutos;
 *   este componente monta cabeçalho e corpo a partir da MESMA lista e já
 *   inclui o menu de colunas. Preferível em tela nova.
 * - `table`/`columnPrefs` (via `useEntityColumnTable`): para telas que já
 *   montam a tabela com `ColumnDef`/`useReactTable`; o menu de colunas fica a
 *   cargo da tela (`visibilityMenuProps`).
 */
export function EntityTable<TData, TField extends string = string>(
  props: EntityTableProps<TData, TField>
) {
  if (props.table) {
    return <EntityTableTanStack {...props} />;
  }

  return <EntityTableItems {...(props as EntityTableItemsProps<TData>)} />;
}

/**
 * `ColumnDragContext` envolve a `<Table>` inteira de propósito: ele monta um
 * div de acessibilidade do dnd-kit onde estiver, e dentro de `<thead>` isso é
 * HTML inválido e erro de hidratação.
 */
function EntityTableTanStack<TData, TField extends string = string>({
  table,
  columnPrefs,
  getSortProps,
  className,
  rowProps,
  cellClassName,
  skeleton,
}: EntityTableTanStackProps<TData, TField>) {
  const draggableIds = new Set(columnPrefs.order);

  return (
    <ColumnDragContext
      columnOrder={columnPrefs.order}
      onReorder={columnPrefs.setOrder}
    >
      <StickyHorizontalScroll>
        <Table className={className}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | EntityColumnMeta
                    | undefined;

                  if (!draggableIds.has(header.column.id)) {
                    return <TableHead key={header.id} />;
                  }

                  return (
                    <DraggableTableHead
                      key={header.id}
                      columnId={header.column.id}
                      label={meta?.label ?? ''}
                      labelHidden={meta?.labelHidden}
                      align={meta?.align}
                      {...(meta?.sortField && getSortProps
                        ? getSortProps(meta.sortField as TField)
                        : {})}
                    />
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {skeleton ??
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} {...rowProps?.(row)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cellClassName?.(cell.column.id)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </StickyHorizontalScroll>
    </ColumnDragContext>
  );
}

function EntityTableItems<TItem>({
  columns,
  items,
  getRowKey,
  onRowClick,
  onRowDoubleClick,
  isRowClickable,
  rowClassName,
  rowProps,
  showColumnsMenu = true,
  body,
  className,
  tableClassName,
}: EntityTableItemsProps<TItem>) {
  return (
    <div className={cn('space-y-2', className)}>
      {showColumnsMenu ? (
        <div className="flex justify-end">
          <ColumnsVisibilityMenu {...columns.menuProps} />
        </div>
      ) : null}

      <ColumnDragContext
        columnOrder={columns.order}
        onReorder={columns.setOrder}
      >
        <StickyHorizontalScroll>
          <Table className={tableClassName}>
            <TableHeader>
              <TableRow>
                {columns.visible.map((column) => (
                  <DraggableTableHead
                    key={column.id}
                    columnId={column.id}
                    label={column.label}
                    labelHidden={column.labelHidden}
                    headContent={column.headerContent}
                    align={column.align}
                    className={column.headClassName}
                    dragDisabled={
                      column.draggable === undefined
                        ? column.hideable === false
                        : !column.draggable
                    }
                    {...(column.sortProps ?? {})}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {body ??
                items.map((item) => {
                  const allowed = isRowClickable?.(item) ?? true;
                  const clickable = !!onRowClick && allowed;
                  const doubleClickable = !!onRowDoubleClick && allowed;

                  return (
                    <TableRow
                      key={getRowKey(item)}
                      className={cn(
                        (clickable || doubleClickable) && 'cursor-pointer',
                        rowClassName?.(item)
                      )}
                      onClick={clickable ? () => onRowClick?.(item) : undefined}
                      onDoubleClick={
                        doubleClickable
                          ? () => onRowDoubleClick?.(item)
                          : undefined
                      }
                      {...rowProps?.(item)}
                    >
                      {columns.visible.map((column) => (
                        <TableCell
                          key={column.id}
                          className={column.className}
                          onClick={
                            column.stopClickPropagation
                              ? (event) => event.stopPropagation()
                              : undefined
                          }
                        >
                          {column.cell(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </StickyHorizontalScroll>
      </ColumnDragContext>
    </div>
  );
}

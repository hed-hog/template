'use client';

import { TableHead } from '@/components/ui/table';
import type { TableSortProps } from '@/hooks/use-table-sort';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';

export type SortableTableHeadAlign = 'left' | 'right' | 'center';

export type SortableTableHeadProps = Omit<
  ComponentProps<'th'>,
  'onClick' | 'children'
> &
  Partial<TableSortProps> & {
    label: string;
    align?: SortableTableHeadAlign;
    /**
     * Rótulo só para leitor de tela: some do cabeçalho sem sumir do menu de
     * colunas nem da leitura acessível. O `sr-only` não ocupa largura, então a
     * coluna encolhe para o que sobra (a alça de arrastar, a seta de ordenação).
     */
    labelHidden?: boolean;
    /** Alça de arrastar (ex.: grip icon) renderizada antes do rótulo. */
    dragHandle?: ReactNode;
  };

/**
 * Cabeçalho de coluna com ordenação server-side.
 *
 * Sem `onSort` (ou sem `sortDirection`) degrada para um `TableHead` puro — assim
 * uma tabela declara todos os cabeçalhos com o mesmo componente e só as colunas
 * ordenáveis recebem `{...sort.getSortProps('campo')}`.
 *
 * Ver `useTableSort` em `@/hooks/use-table-sort` e a seção "SortableTableHead"
 * do README desta pasta para o uso canônico.
 */
export function SortableTableHead({
  label,
  align = 'left',
  labelHidden,
  sortDirection,
  onSort,
  className,
  dragHandle,
  ...props
}: SortableTableHeadProps) {
  const t = useTranslations('core.TableSort');

  const labelNode = labelHidden ? (
    <span className="sr-only">{label}</span>
  ) : (
    label
  );

  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left';

  if (!onSort || sortDirection === undefined) {
    return (
      <TableHead className={cn(alignClass, className)} {...props}>
        {dragHandle ? (
          <span className="inline-flex items-center gap-1">
            {dragHandle}
            {labelNode}
          </span>
        ) : (
          labelNode
        )}
      </TableHead>
    );
  }

  const active = sortDirection !== null;
  const Icon = !active
    ? ArrowUpDown
    : sortDirection === 'asc'
      ? ArrowUp
      : ArrowDown;

  return (
    // `aria-sort` vai na célula: o role implícito de <button> não o suporta, e o
    // leitor de tela precisa saber por qual coluna a tabela está ordenada, não
    // qual botão foi clicado.
    <TableHead
      aria-sort={
        active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn('group/th', alignClass, className)}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {dragHandle}
        <button
          type="button"
          onClick={onSort}
          title={
            active && sortDirection === 'asc'
              ? t('sortDescending')
              : t('sortAscending')
          }
          className={cn(
            'hover:text-foreground focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none',
            align === 'right' && 'flex-row-reverse',
            align === 'center' && 'justify-center',
            active ? 'text-foreground font-semibold' : 'text-muted-foreground'
          )}
        >
          {labelNode}
          {/* Coluna inativa mostra a seta dupla só no hover/foco: sinaliza que dá
              para clicar sem encher o cabeçalho de ícones cinzas. */}
          <Icon
            className={cn(
              'size-3 shrink-0 transition-opacity',
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover/th:opacity-60 group-focus-within/th:opacity-60'
            )}
            aria-hidden="true"
          />
        </button>
      </span>
    </TableHead>
  );
}

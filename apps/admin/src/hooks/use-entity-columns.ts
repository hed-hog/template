'use client';

import type { ColumnsVisibilityMenuProps } from '@/components/entity-list/columns-visibility-menu';
import type { SortableTableHeadAlign } from '@/components/entity-list/sortable-table-head';
import type { TableSortProps } from '@/hooks/use-table-sort';
import { useMemo, type ReactNode } from 'react';
import { useColumnPreferences } from './use-column-preferences';

export type EntityTableColumn<TItem> = {
  /** Id estável: é o que a preferência do usuário guarda. Nunca renomeie sem trocar a `storageKey`. */
  id: string;
  label: string;
  /**
   * `true` esconde o rótulo no cabeçalho sem tirá-lo do menu de colunas nem da
   * leitura acessível (coluna de seleção, por exemplo).
   */
  labelHidden?: boolean;
  align?: SortableTableHeadAlign;
  /** `{...sort.getSortProps('campo')}`. Ausente = cabeçalho sem seta. */
  sortProps?: Partial<TableSortProps>;
  /** Classe da célula do corpo. */
  className?: string;
  /** Classe do `<th>` (largura fixa, por exemplo). */
  headClassName?: string;
  /** `false` trava a coluna: não esconde e não arrasta (ex.: a de ações). */
  hideable?: boolean;
  /** A linha inteira navega; a célula de ações não deve arrastar o clique junto. */
  stopClickPropagation?: boolean;
  cell: (item: TItem) => ReactNode;
};

export type EntityColumnsState<TItem> = {
  /** Todas as colunas declaradas, na ordem de fábrica. */
  all: EntityTableColumn<TItem>[];
  /** Na ordem escolhida pelo usuário, já sem as escondidas — o que a tabela renderiza. */
  visible: EntityTableColumn<TItem>[];
  order: string[];
  hidden: string[];
  setOrder: (nextOrder: string[]) => void;
  toggleColumn: (id: string, visible: boolean) => void;
  reset: () => void;
  /** Pronto para `<ColumnsVisibilityMenu {...state.menuProps} />`. */
  menuProps: ColumnsVisibilityMenuProps;
};

export type UseEntityColumnsOptions<TItem> = {
  /**
   * Chave da preferência no localStorage. Estável e única por tabela — inclua a
   * entidade quando uma tela serve mais de uma (`commerce-orders-columns-v1`).
   */
  storageKey: string;
  columns: EntityTableColumn<TItem>[];
};

/**
 * Ordem e visibilidade de colunas de uma listagem, a partir da lista de colunas
 * da tela. É a metade "estado" do par com `EntityTable`, que é a metade
 * "render": a tela declara as colunas uma vez e as duas leem a MESMA lista, então
 * cabeçalho e corpo não têm como divergir.
 *
 * Guarda por usuário no localStorage (ver `useColumnPreferences`).
 */
export function useEntityColumns<TItem>({
  storageKey,
  columns,
}: UseEntityColumnsOptions<TItem>): EntityColumnsState<TItem> {
  const columnIds = useMemo(
    () => columns.map((column) => column.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns.map((column) => column.id).join('\0')]
  );

  const requiredIds = useMemo(
    () =>
      columns
        .filter((column) => column.hideable === false)
        .map((column) => column.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      columns
        .filter((column) => column.hideable === false)
        .map((column) => column.id)
        .join('\0'),
    ]
  );

  const prefs = useColumnPreferences({ storageKey, columnIds, requiredIds });

  /** A ordem salva é a fonte; coluna que sumiu da declaração é simplesmente ignorada. */
  const ordered = prefs.order
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is EntityTableColumn<TItem> => !!column);

  const visible = ordered.filter(
    (column) => prefs.visibility[column.id] !== false
  );

  return {
    all: columns,
    visible,
    order: prefs.order,
    hidden: prefs.hidden,
    setOrder: prefs.setOrder,
    toggleColumn: prefs.toggleColumn,
    reset: prefs.reset,
    menuProps: {
      columns: ordered.map((column) => ({
        id: column.id,
        label: column.label,
        hideable: column.hideable,
      })),
      hidden: prefs.hidden,
      onToggle: prefs.toggleColumn,
      onReset: prefs.reset,
    },
  };
}

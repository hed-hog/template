'use client';

import { useCallback, useMemo, useState } from 'react';

export type SortOrder = 'asc' | 'desc';

export type TableSortState<TField extends string = string> = {
  field: TField;
  order: SortOrder;
};

/** Coluna ordenável: só o nome (1º clique = 'asc') ou nome + direção inicial. */
export type SortableColumn<TField extends string> =
  | TField
  | { field: TField; initialOrder?: SortOrder };

/**
 * Props consumidas pelo `SortableTableHead`. O tipo vive aqui para o componente
 * importar do hook, e não o contrário — components → hooks é mão única.
 */
export type TableSortProps = {
  sortDirection: SortOrder | null;
  onSort: () => void;
};

export interface UseTableSortOptions<TField extends string> {
  /**
   * Allowlist dos campos que podem chegar ao backend em `sortField`. O
   * `@Pagination()` devolve 400 para campo que não existe no model, então esta
   * lista é o contrato: o que não está nela nunca vira query param.
   */
  columns: readonly SortableColumn<TField>[];
  defaultSort: TableSortState<TField>;
  /**
   * Chamado a cada mudança de ordenação. Em listagem paginada é obrigatório
   * passar `() => setPage(1)`: ordenar sem voltar à primeira página mostra "a
   * página 3 da nova ordem", que nunca é o que o usuário pediu.
   */
  onSortChange?: (sort: TableSortState<TField>) => void;
  /** Modo controlado — usado quando quem guarda a ordenação é a URL. */
  value?: TableSortState<TField>;
  onValueChange?: (sort: TableSortState<TField>) => void;
}

export interface UseTableSortResult<TField extends string> {
  sort: TableSortState<TField>;
  sortField: TField;
  sortOrder: SortOrder;
  isSortable: (field: string) => field is TField;
  toggleSort: (field: TField) => void;
  setSort: (sort: TableSortState<TField>) => void;
  resetSort: () => void;
  getSortProps: (field: TField) => TableSortProps;
}

/**
 * Estado de ordenação de uma tabela paginada no servidor.
 *
 * Não conhece paginação, react-query nem URL — é isso que o torna reutilizável
 * em tabela de listagem, de detalhe, de aba e de sheet. Quem chama liga as
 * pontas: `sortField`/`sortOrder` vão para os params da requisição e para a
 * `queryKey`, e `onSortChange` volta a página para 1.
 *
 * São dois estados por coluna (asc ↔ desc), não três: paginação server-side
 * sempre precisa de uma ordem estável, e um terceiro clique que "desliga" a
 * ordenação só reintroduz o default por outro caminho.
 */
export function useTableSort<TField extends string>({
  columns,
  defaultSort,
  onSortChange,
  value,
  onValueChange,
}: UseTableSortOptions<TField>): UseTableSortResult<TField> {
  const [internalSort, setInternalSort] =
    useState<TableSortState<TField>>(defaultSort);
  const sort = value ?? internalSort;

  // Mapa campo → direção inicial. Declarar `columns` como constante de módulo
  // (o uso canônico) mantém a identidade estável entre renders; passar um
  // literal inline só faz este `useMemo` recalcular, o que é barato.
  const initialOrderByField = useMemo(() => {
    const map = new Map<string, SortOrder>();
    for (const column of columns) {
      if (typeof column === 'string') {
        map.set(column, 'asc');
      } else {
        map.set(column.field, column.initialOrder ?? 'asc');
      }
    }
    return map;
  }, [columns]);

  const initialOrderOf = useCallback(
    (field: string): SortOrder | undefined => initialOrderByField.get(field),
    [initialOrderByField]
  );

  const isSortable = useCallback(
    (field: string): field is TField => initialOrderOf(field) !== undefined,
    [initialOrderOf]
  );

  const applySort = useCallback(
    (next: TableSortState<TField>) => {
      if (value === undefined) setInternalSort(next);
      onValueChange?.(next);
      onSortChange?.(next);
    },
    [onSortChange, onValueChange, value]
  );

  const toggleSort = useCallback(
    (field: TField) => {
      const initialOrder = initialOrderOf(field);
      // Fora da allowlist não vira request: o backend responderia 400 e a tela
      // ficaria sem dados por causa de um clique num cabeçalho.
      if (initialOrder === undefined) return;

      // Trocar de coluna reinicia a direção. Herdar o 'desc' da coluna anterior
      // faz a nova coluna abrir invertida, e isso é sempre uma surpresa.
      const next: TableSortState<TField> =
        field === sort.field
          ? { field, order: sort.order === 'asc' ? 'desc' : 'asc' }
          : { field, order: initialOrder };

      applySort(next);
    },
    [applySort, initialOrderOf, sort.field, sort.order]
  );

  const getSortProps = useCallback(
    (field: TField): TableSortProps => ({
      sortDirection: sort.field === field ? sort.order : null,
      onSort: () => toggleSort(field),
    }),
    [sort.field, sort.order, toggleSort]
  );

  const resetSort = useCallback(
    () => applySort(defaultSort),
    // `defaultSort` costuma ser um literal de módulo; se vier inline, a
    // identidade nova a cada render só recria este callback.
    [applySort, defaultSort]
  );

  return {
    sort,
    sortField: sort.field,
    sortOrder: sort.order,
    isSortable,
    toggleSort,
    setSort: applySort,
    resetSort,
    getSortProps,
  };
}

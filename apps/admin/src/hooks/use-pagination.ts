import { useMemo, useState } from 'react';
import { usePaginationFetch } from './use-pagination-fetch';
import { usePersistedPageSize } from './use-persisted-page-size';
import { useTableSort, type SortableColumn } from './use-table-sort';

type PaginationOption = {
  pageSizeOptions: readonly number[];
  maxPages?: number;
};

/**
 * Identidade estável para quem não passa `sortColumns`. Um literal inline
 * aqui recriaria o mapa do `useTableSort` a cada render.
 */
const SEM_ORDENACAO: readonly never[] = [];

type UsePaginationProps<TField extends string> = {
  url: string;
  paginationOptions?: PaginationOption;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
  storageKey?: string;
  /**
   * Allowlist dos campos que o backend aceita em `sortField`. Passando ela, o
   * `sort` devolvido já vem pronto para o `SortableTableHead`; sem ela o hook
   * se comporta como antes e nenhum cabeçalho fica clicável.
   */
  sortColumns?: readonly SortableColumn<TField>[];
};

export const usePagination = <TField extends string = string>({
  url,
  paginationOptions,
  orderField,
  orderDirection,
  storageKey,
  sortColumns,
}: UsePaginationProps<TField>) => {
  const [sortField, setSortField] = useState<string | undefined>(orderField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(
    orderDirection ?? 'desc'
  );
  const [page, setPage] = useState(1);
  const pageSizeOptions = paginationOptions?.pageSizeOptions ?? [10];
  const [pageSize, setPageSize] = usePersistedPageSize({
    storageKey: storageKey ?? 'pagination:global:pageSize',
    defaultValue: pageSizeOptions[0] ?? 10,
    allowedValues: pageSizeOptions,
  });
  const [search, setSearch] = useState('');

  // Modo controlado: o estado continua sendo o deste hook — o `useTableSort`
  // só decide qual é a próxima direção e qual coluna está ativa. Voltar para a
  // página 1 faz parte da mudança: ordenar sem isso mostra "a página 3 da nova
  // ordem", que nunca é o que o usuário pediu.
  const sort = useTableSort<TField>({
    columns: sortColumns ?? (SEM_ORDENACAO as readonly SortableColumn<TField>[]),
    defaultSort: {
      field: (orderField ?? 'id') as TField,
      order: orderDirection ?? 'desc',
    },
    value: {
      field: (sortField ?? orderField ?? 'id') as TField,
      order: sortOrder ?? 'desc',
    },
    onValueChange: (next) => {
      setSortField(next.field);
      setSortOrder(next.order);
      setPage(1);
    },
  });

  const {
    data: paginatedData,
    isLoading,
    refetch,
  } = usePaginationFetch({
    url,
    page,
    pageSize,
    search,
    sortField,
    sortOrder,
  });

  const items = useMemo(() => {
    if (!paginatedData?.data || !Array.isArray(paginatedData.data)) {
      return [];
    }
    return paginatedData.data;
  }, [paginatedData]);

  const totalItems = useMemo(() => {
    if (!paginatedData?.total || typeof paginatedData.total !== 'number') {
      return 0;
    }
    return paginatedData.total;
  }, [paginatedData]);

  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / pageSize);
  }, [pageSize, totalItems]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    items,
    refetch,
    totalItems,
    isLoading,
    search,
    setSearch,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    sort,
    totalPages,
  };
};

import { useMemo, useState } from 'react';
import { usePaginationFetch } from './use-pagination-fetch';
import { usePersistedPageSize } from './use-persisted-page-size';

type PaginationOption = {
  pageSizeOptions: readonly number[];
  maxPages?: number;
};

type UsePaginationProps = {
  url: string;
  paginationOptions?: PaginationOption;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
  storageKey?: string;
};

export const usePagination = ({
  url,
  paginationOptions,
  orderField,
  orderDirection,
  storageKey,
}: UsePaginationProps) => {
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
    totalPages,
  };
};

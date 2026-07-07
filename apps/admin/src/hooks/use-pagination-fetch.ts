import { useApp } from '@hed-hog/next-app-provider';
import type { PaginationEnvelope } from '@hed-hog/api-types';
import { useCallback, useEffect, useRef, useState } from 'react';

// Shared contract (single source in @hed-hog/api-types/contracts) instead of
// re-declaring the pagination envelope locally — changes to the API shape are
// caught by the contract tests before they break this hook.
type PaginationResponse<T = any> = PaginationEnvelope<T>;

interface UsePaginationFetchResult<T = any> {
  data: PaginationResponse<T>;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

interface PaginationFetchProps {
  url: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: string;
  sortOrder?: string;
  fields?: string[];
}

function shouldIgnoreAuthFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeAxiosError = error as {
    response?: { status?: number; data?: { message?: unknown } };
    message?: unknown;
  };

  const status = maybeAxiosError.response?.status;
  if (status === 401 || status === 403) {
    return true;
  }

  const backendMessage = maybeAxiosError.response?.data?.message;
  const message =
    typeof backendMessage === 'string'
      ? backendMessage
      : typeof maybeAxiosError.message === 'string'
        ? maybeAxiosError.message
        : '';

  return message.toLowerCase().includes('failed to refresh token');
}

export function usePaginationFetch<T = any>(
  props: PaginationFetchProps
): UsePaginationFetchResult<T> {
  const { request } = useApp();
  const normalizedPage =
    typeof props.page === 'number' &&
    Number.isFinite(props.page) &&
    props.page > 0
      ? props.page
      : 1;
  const normalizedPageSize =
    typeof props.pageSize === 'number' &&
    Number.isFinite(props.pageSize) &&
    props.pageSize > 0
      ? props.pageSize
      : 10;

  const [data, setData] = useState<PaginationResponse<T>>({
    data: [],
    total: 0,
    lastPage: 0,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    prev: null,
    next: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { url, fields, search, sortField, sortOrder } = props;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: normalizedPage,
        pageSize: normalizedPageSize,
      };

      if (Array.isArray(fields) && fields.length > 0) {
        params.fields = fields;
      }

      if (typeof search === 'string' && search.trim().length > 0) {
        params.search = search;
      }

      if (typeof sortField === 'string' && sortField.trim().length > 0) {
        params.sortField = sortField;
      }

      if (typeof sortOrder === 'string' && sortOrder.trim().length > 0) {
        params.sortOrder = sortOrder;
      }

      const { data } = await request<PaginationResponse<T>>({
        url,
        params,
      });
      setData(data);
    } catch (error) {
      if (!shouldIgnoreAuthFetchError(error)) {
        console.warn('Falha ao buscar dados paginados.', {
          url,
          error,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    url,
    normalizedPage,
    normalizedPageSize,
    fields,
    search,
    sortField,
    sortOrder,
    request,
  ]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (search) {
      timeoutRef.current = setTimeout(() => {
        fetchData();
      }, 400);
    } else {
      fetchData();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchData, search]);

  return {
    data,
    isLoading,
    refetch: fetchData,
  };
}

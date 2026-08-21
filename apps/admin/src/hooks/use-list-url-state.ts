'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useDebounce } from './use-debounce';

interface UrlFilterFieldConfig {
  param: string;
  defaultValue: string;
}

type UrlFilterConfigMap = Record<string, UrlFilterFieldConfig>;

interface UseListUrlStateOptions<TFilters extends UrlFilterConfigMap> {
  filters: TFilters;
  searchParam?: string;
  pageParam?: string;
  searchDebounceMs?: number;
}

/**
 * Keeps a list page's search/filters/page in sync with the URL query string,
 * so navigating away (e.g. to a detail route) and back restores the same
 * result set instead of resetting to defaults on remount.
 *
 * Unmanaged query params already present in the URL (e.g. `editId` used to
 * deep-link a sheet) are preserved across writes.
 */
export function useListUrlState<TFilters extends UrlFilterConfigMap>({
  filters,
  searchParam = 'search',
  pageParam = 'page',
  searchDebounceMs = 350,
}: UseListUrlStateOptions<TFilters>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterKeys = Object.keys(filters) as Array<keyof TFilters & string>;

  const [search, setSearch] = useState(
    () => searchParams.get(searchParam) ?? ''
  );
  const debouncedSearch = useDebounce(search.trim(), searchDebounceMs);

  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const key of filterKeys) {
        const config = filters[key]!;
        initial[key] = searchParams.get(config.param) ?? config.defaultValue;
      }
      return initial;
    }
  );

  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get(pageParam));
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  });

  // Volta para a página 1 quando busca/filtros mudam — exceto na primeira
  // execução, para não sobrescrever a página lida da URL no carregamento
  // inicial.
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, filterValues]);

  // Reflete busca/filtros/página na URL. Parte dos parâmetros já presentes
  // (em vez de montar a query do zero) para preservar chaves não gerenciadas
  // por este hook, como o `editId` usado para deep-link de sheets.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (debouncedSearch) {
      params.set(searchParam, debouncedSearch);
    } else {
      params.delete(searchParam);
    }

    for (const key of filterKeys) {
      const { param, defaultValue } = filters[key]!;
      const value = filterValues[key];
      if (value && value !== defaultValue) {
        params.set(param, value);
      } else {
        params.delete(param);
      }
    }

    if (page > 1) {
      params.set(pageParam, String(page));
    } else {
      params.delete(pageParam);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, filterValues, pathname, router]);

  const setFilter = (key: keyof TFilters & string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  return {
    search,
    setSearch,
    debouncedSearch,
    filters: filterValues as { [K in keyof TFilters]: string },
    setFilter,
    page,
    setPage,
  };
}

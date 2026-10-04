'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useDebounce } from './use-debounce';
import type { SortOrder, TableSortState } from './use-table-sort';

interface UrlFilterFieldConfig {
  param: string;
  defaultValue: string;
}

type UrlFilterConfigMap = Record<string, UrlFilterFieldConfig>;

interface UrlSortConfig<TSortField extends string> {
  /** Nome do parâmetro do campo. Default `sortField`, o que a API espera. */
  param?: string;
  /** Nome do parâmetro da direção. Default `sortOrder`. */
  orderParam?: string;
  default: TableSortState<TSortField>;
  /**
   * Mesma allowlist passada ao `useTableSort`. URL editada à mão com um campo
   * fora dela cai no default em vez de virar um 400 do `@Pagination()`.
   */
  allowedFields: readonly TSortField[];
}

interface UseListUrlStateOptions<
  TFilters extends UrlFilterConfigMap,
  TSortField extends string,
> {
  filters: TFilters;
  searchParam?: string;
  pageParam?: string;
  searchDebounceMs?: number;
  /** Habilita a sincronização da ordenação com a URL. */
  sort?: UrlSortConfig<TSortField>;
}

function isSortOrder(value: string | null): value is SortOrder {
  return value === 'asc' || value === 'desc';
}

/**
 * Keeps a list page's search/filters/page in sync with the URL query string,
 * so navigating away (e.g. to a detail route) and back restores the same
 * result set instead of resetting to defaults on remount.
 *
 * Com a opção `sort`, a ordenação entra na mesma query string e o hook vira o
 * único escritor da URL — o `useTableSort` roda em modo controlado a partir
 * daqui, em vez de manter um estado paralelo.
 *
 * Unmanaged query params already present in the URL (e.g. `editId` used to
 * deep-link a sheet) are preserved across writes.
 */
export function useListUrlState<
  TFilters extends UrlFilterConfigMap,
  TSortField extends string = string,
>({
  filters,
  searchParam = 'search',
  pageParam = 'page',
  searchDebounceMs = 350,
  sort,
}: UseListUrlStateOptions<TFilters, TSortField>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterKeys = Object.keys(filters) as Array<keyof TFilters & string>;

  const sortParam = sort?.param ?? 'sortField';
  const sortOrderParam = sort?.orderParam ?? 'sortOrder';

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

  // Sem a opção `sort`, este estado nasce `null` e nunca muda — os efeitos
  // abaixo então não leem nem escrevem os parâmetros de ordenação, e quem já
  // usava o hook não percebe diferença nenhuma.
  const [sortState, setSortState] = useState<TableSortState<TSortField> | null>(
    () => {
      if (!sort) return null;

      const field = searchParams.get(sortParam) as TSortField | null;
      const order = searchParams.get(sortOrderParam);

      // Campo fora da allowlist invalida a especificação inteira: aproveitar só
      // a direção deixaria a lista numa ordem que ninguém pediu, e com os dois
      // parâmetros ainda pendurados na URL. Direção inválida sozinha é mais
      // branda — o campo continua bom, só a direção volta ao default.
      if (!field || !sort.allowedFields.includes(field)) {
        return sort.default;
      }

      return {
        field,
        order: isSortOrder(order) ? order : sort.default.order,
      };
    }
  );

  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get(pageParam));
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  });

  // Volta para a página 1 quando busca/filtros/ordenação mudam, mas não no
  // carregamento inicial — senão a página lida da URL seria sobrescrita.
  //
  // A comparação é pelo valor, não por um "é a primeira execução?": o
  // StrictMode do Next em dev invoca o efeito duas vezes no mount e a ref não
  // volta atrás entre elas, então uma flag booleana deixava a segunda passada
  // resetar a página e um link para `?page=3` sempre abria na 1.
  const lastAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const current = JSON.stringify([debouncedSearch, filterValues, sortState]);

    if (lastAppliedRef.current === current) {
      return;
    }

    const isInitialRun = lastAppliedRef.current === null;
    lastAppliedRef.current = current;

    if (!isInitialRun) {
      setPage(1);
    }
  }, [debouncedSearch, filterValues, sortState]);

  // Reflete busca/filtros/ordenação/página na URL. Parte dos parâmetros já
  // presentes (em vez de montar a query do zero) para preservar chaves não
  // gerenciadas por este hook, como o `editId` usado para deep-link de sheets.
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

    if (sort && sortState) {
      // Os dois parâmetros andam juntos: `?sortOrder=desc` sozinho seria uma
      // ordem ambígua na hora de ler a URL de volta.
      const isDefaultSort =
        sortState.field === sort.default.field &&
        sortState.order === sort.default.order;

      if (isDefaultSort) {
        params.delete(sortParam);
        params.delete(sortOrderParam);
      } else {
        params.set(sortParam, sortState.field);
        params.set(sortOrderParam, sortState.order);
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
  }, [debouncedSearch, page, filterValues, sortState, pathname, router]);

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
    /** `null` quando a opção `sort` não foi passada. */
    sort: sortState,
    setSort: setSortState,
  };
}

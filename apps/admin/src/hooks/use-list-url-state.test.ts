import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

const push = vi.fn();
const replace = vi.fn();
const routerMock = { push, replace, refresh: vi.fn(), prefetch: vi.fn() };
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/finance/accounts-payable/installments',
  useSearchParams: () => currentSearchParams,
}));

import { useListUrlState } from './use-list-url-state';

const FILTERS = {
  status: { param: 'status', defaultValue: 'all' },
  from: { param: 'from', defaultValue: '' },
  to: { param: 'to', defaultValue: '' },
};

function setUrl(query: string) {
  currentSearchParams = new URLSearchParams(query);
}

describe('useListUrlState', () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    setUrl('');
  });

  afterEach(() => vi.useRealTimers());

  it('inicializa search/filtros/página a partir da URL', () => {
    setUrl('search=acme&status=aberto&page=3&editId=abc');
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    expect(result.current.search).toBe('acme');
    expect(result.current.debouncedSearch).toBe('acme');
    expect(result.current.filters.status).toBe('aberto');
    expect(result.current.filters.from).toBe('');
    expect(result.current.page).toBe(3);
  });

  it('usa os defaults quando a URL não tem parâmetros', () => {
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    expect(result.current.search).toBe('');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.page).toBe(1);
  });

  it('escreve o filtro alterado na URL preservando parâmetros não gerenciados (editId)', () => {
    setUrl('editId=abc');
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    act(() => result.current.setFilter('status', 'liquidado'));

    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split('?')[1]);
    expect(params.get('status')).toBe('liquidado');
    expect(params.get('editId')).toBe('abc');
  });

  it('omite da URL um filtro igual ao default', () => {
    setUrl('status=aberto');
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    act(() => result.current.setFilter('status', 'all'));

    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toBe('/finance/accounts-payable/installments');
  });

  it('reseta a página para 1 ao mudar um filtro, mas não na primeira execução', () => {
    setUrl('page=3');
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    expect(result.current.page).toBe(3);

    act(() => result.current.setFilter('status', 'vencido'));
    expect(result.current.page).toBe(1);
  });

  it('preserva a página da URL sob StrictMode (efeito invocado duas vezes)', () => {
    // O StrictMode do Next em dev roda o efeito duas vezes no mount, e uma ref
    // não volta atrás entre as passadas: com uma flag "primeira execução?" a
    // segunda passada resetava a página e um link para `?page=3` abria na 1.
    setUrl('page=3&status=aberto');
    const { result } = renderHook(
      () => useListUrlState({ filters: FILTERS }),
      { wrapper: StrictMode }
    );

    expect(result.current.page).toBe(3);
    expect(result.current.filters.status).toBe('aberto');
  });

  it('sem a opção sort, não lê nem escreve os params de ordenação', () => {
    setUrl('sortField=name&sortOrder=desc');
    const { result } = renderHook(() => useListUrlState({ filters: FILTERS }));

    expect(result.current.sort).toBeNull();

    act(() => result.current.setFilter('status', 'liquidado'));

    // Os params de ordenação vieram da URL e continuam lá: o hook não os
    // gerencia, então também não pode apagá-los.
    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split('?')[1]);
    expect(params.get('sortField')).toBe('name');
    expect(params.get('sortOrder')).toBe('desc');
  });

  describe('com a opção sort', () => {
    const SORT = {
      default: { field: 'id', order: 'desc' },
      allowedFields: ['id', 'name', 'slug'],
    } as const;

    it('cai no default quando a URL não traz ordenação', () => {
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      expect(result.current.sort).toEqual({ field: 'id', order: 'desc' });
    });

    it('lê campo e direção válidos da URL', () => {
      setUrl('sortField=name&sortOrder=asc');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });
    });

    it('campo fora da allowlist descarta a ordenação inteira, não só o campo', () => {
      setUrl('sortField=hack&sortOrder=asc');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      // Aproveitar o `asc` deixaria a lista em `id asc`, uma ordem que ninguém
      // pediu, e ainda manteria os dois params pendurados na URL.
      expect(result.current.sort).toEqual({ field: 'id', order: 'desc' });
    });

    it('URL adulterada é limpa na primeira escrita', () => {
      setUrl('sortField=hack&sortOrder=asc');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      act(() => result.current.setFilter('status', 'aberto'));

      const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
      const params = new URLSearchParams(lastUrl.split('?')[1]);
      expect(params.get('sortField')).toBeNull();
      expect(params.get('sortOrder')).toBeNull();
    });

    it('direção inválida cai no default', () => {
      setUrl('sortField=name&sortOrder=sideways');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      expect(result.current.sort).toEqual({ field: 'name', order: 'desc' });
    });

    it('escreve os dois params juntos ao mudar a ordenação', () => {
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      act(() => result.current.setSort({ field: 'slug', order: 'asc' }));

      const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
      const params = new URLSearchParams(lastUrl.split('?')[1]);
      expect(params.get('sortField')).toBe('slug');
      expect(params.get('sortOrder')).toBe('asc');
    });

    it('omite da URL a ordenação igual ao default', () => {
      setUrl('sortField=name&sortOrder=asc');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      act(() => result.current.setSort({ field: 'id', order: 'desc' }));

      const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).toBe('/finance/accounts-payable/installments');
    });

    it('mudar a ordenação reseta a página para 1', () => {
      setUrl('page=4');
      const { result } = renderHook(() =>
        useListUrlState({ filters: FILTERS, sort: SORT })
      );

      expect(result.current.page).toBe(4);

      act(() => result.current.setSort({ field: 'name', order: 'asc' }));
      expect(result.current.page).toBe(1);
    });
  });

  it('busca (debounced) chega na URL só depois do delay', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useListUrlState({ filters: FILTERS, searchDebounceMs: 300 })
    );

    act(() => result.current.setSearch('vanessa'));
    expect(result.current.debouncedSearch).toBe('');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.debouncedSearch).toBe('vanessa');

    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split('?')[1]);
    expect(params.get('search')).toBe('vanessa');
  });
});

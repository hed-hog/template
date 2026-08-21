import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

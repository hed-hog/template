import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// usePagination combines usePaginationFetch (which uses useApp/axios) with pure
// derivations. We mock the fetch to exercise only the items/total/pages logic.
const { fetchState } = vi.hoisted(() => ({
  fetchState: {
    data: {
      data: [] as unknown[],
      total: 0,
      lastPage: 0,
      page: 1,
      pageSize: 10,
      prev: null,
      next: null,
    } as any,
    isLoading: false,
    refetch: () => Promise.resolve(),
  },
}));

vi.mock('./use-pagination-fetch', () => ({
  usePaginationFetch: () => fetchState,
}));

import { usePagination } from './use-pagination';

describe('usePagination', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchState.data = {
      data: [],
      total: 0,
      lastPage: 0,
      page: 1,
      pageSize: 10,
      prev: null,
      next: null,
    };
  });

  it('deriva items, totalItems e totalPages da resposta', () => {
    fetchState.data = { data: [1, 2, 3], total: 25 };
    const { result } = renderHook(() => usePagination({ url: '/x' }));
    expect(result.current.items).toEqual([1, 2, 3]);
    expect(result.current.totalItems).toBe(25);
    // default pageSize = pageSizeOptions[0] ?? 10 → 10; ceil(25/10) = 3
    expect(result.current.totalPages).toBe(3);
  });

  it('sanitiza data ausente/não-array para lista vazia', () => {
    fetchState.data = { data: null, total: 5 };
    const { result } = renderHook(() => usePagination({ url: '/x' }));
    expect(result.current.items).toEqual([]);
  });

  it('sanitiza total não-numérico para zero', () => {
    fetchState.data = { data: [1], total: 'oops' };
    const { result } = renderHook(() => usePagination({ url: '/x' }));
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPages).toBe(0);
  });

  it('respeita pageSizeOptions para o pageSize inicial', () => {
    fetchState.data = { data: [], total: 100 };
    const { result } = renderHook(() =>
      usePagination({ url: '/x', paginationOptions: { pageSizeOptions: [20, 50] } }),
    );
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalPages).toBe(5); // ceil(100/20)
  });

  it('começa na página 1 e expõe os setters', () => {
    const { result } = renderHook(() => usePagination({ url: '/x' }));
    expect(result.current.page).toBe(1);
    expect(typeof result.current.setPage).toBe('function');
    expect(typeof result.current.setSearch).toBe('function');
  });

  it('cai no default 10 quando pageSizeOptions é um array vazio', () => {
    fetchState.data = { data: [], total: 30 };
    const { result } = renderHook(() =>
      usePagination({ url: '/x', paginationOptions: { pageSizeOptions: [] } }),
    );
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(3); // ceil(30/10)
  });
});

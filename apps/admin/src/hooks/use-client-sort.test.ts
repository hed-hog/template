import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useClientSort } from './use-client-sort';

type Row = { name: string; total: number | null };

const rows: Row[] = [
  { name: 'Item 10', total: 3 },
  { name: 'ítem 2', total: null },
  { name: 'Alpha', total: 7 },
];

const accessors = {
  name: (row: Row) => row.name,
  total: (row: Row) => row.total,
};

describe('useClientSort', () => {
  it('ordena texto sem acento/caixa e com números em ordem natural', () => {
    const { result } = renderHook(() =>
      useClientSort(rows, 'name', 'asc', accessors)
    );
    expect(result.current.map((row) => row.name)).toEqual([
      'Alpha',
      'ítem 2',
      'Item 10',
    ]);
  });

  it('ordena números de forma decrescente e manda vazios para o fim', () => {
    const { result } = renderHook(() =>
      useClientSort(rows, 'total', 'desc', accessors)
    );
    expect(result.current.map((row) => row.total)).toEqual([7, 3, null]);
  });

  it('não altera a lista original e aceita lista indefinida', () => {
    const { result } = renderHook(() =>
      useClientSort<Row, 'name' | 'total'>(undefined, 'name', 'asc', accessors)
    );
    expect(result.current).toEqual([]);
    expect(rows[0]?.name).toBe('Item 10');
  });
});

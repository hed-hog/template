import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTableSort, type SortableColumn } from './use-table-sort';

type Field = 'id' | 'name' | 'slug' | 'created_at';

const COLUMNS: readonly SortableColumn<Field>[] = [
  'id',
  'name',
  'slug',
  { field: 'created_at', initialOrder: 'desc' },
];

const DEFAULT_SORT = { field: 'id', order: 'desc' } as const;

function setup(
  options: Partial<Parameters<typeof useTableSort<Field>>[0]> = {}
) {
  const onSortChange = vi.fn();
  const view = renderHook(() =>
    useTableSort<Field>({
      columns: COLUMNS,
      defaultSort: DEFAULT_SORT,
      onSortChange,
      ...options,
    })
  );
  return { ...view, onSortChange };
}

describe('useTableSort', () => {
  it('começa no defaultSort', () => {
    const { result } = setup();

    expect(result.current.sort).toEqual({ field: 'id', order: 'desc' });
    expect(result.current.sortField).toBe('id');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('primeiro clique numa coluna nova abre em asc', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('name'));

    expect(result.current.sort).toEqual({ field: 'name', order: 'asc' });
  });

  it('respeita o initialOrder declarado na coluna', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('created_at'));

    expect(result.current.sort).toEqual({ field: 'created_at', order: 'desc' });
  });

  it('clique repetido na coluna ativa alterna asc ↔ desc', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('name'));
    expect(result.current.sortOrder).toBe('asc');

    act(() => result.current.toggleSort('name'));
    expect(result.current.sortOrder).toBe('desc');

    act(() => result.current.toggleSort('name'));
    expect(result.current.sortOrder).toBe('asc');
  });

  it('trocar de coluna reseta a direção em vez de herdar a anterior', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('name'));
    act(() => result.current.toggleSort('name')); // name desc
    expect(result.current.sort).toEqual({ field: 'name', order: 'desc' });

    act(() => result.current.toggleSort('slug'));
    expect(result.current.sort).toEqual({ field: 'slug', order: 'asc' });
  });

  it('chama onSortChange a cada mudança, com o novo estado', () => {
    const { result, onSortChange } = setup();

    act(() => result.current.toggleSort('slug'));

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith({ field: 'slug', order: 'asc' });
  });

  it('campo fora da allowlist é no-op e não chama onSortChange', () => {
    const { result, onSortChange } = setup();

    act(() => result.current.toggleSort('hack' as Field));

    expect(result.current.sort).toEqual(DEFAULT_SORT);
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it('isSortable reconhece só os campos declarados', () => {
    const { result } = setup();

    expect(result.current.isSortable('name')).toBe(true);
    expect(result.current.isSortable('created_at')).toBe(true);
    expect(result.current.isSortable('color')).toBe(false);
  });

  it('getSortProps devolve null para coluna inativa e a direção para a ativa', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('name'));

    expect(result.current.getSortProps('name').sortDirection).toBe('asc');
    expect(result.current.getSortProps('slug').sortDirection).toBeNull();
  });

  it('getSortProps().onSort ordena pela coluna correspondente', () => {
    const { result } = setup();

    act(() => result.current.getSortProps('slug').onSort());

    expect(result.current.sort).toEqual({ field: 'slug', order: 'asc' });
  });

  it('resetSort volta ao default', () => {
    const { result } = setup();

    act(() => result.current.toggleSort('name'));
    act(() => result.current.resetSort());

    expect(result.current.sort).toEqual(DEFAULT_SORT);
  });

  it('modo controlado: não muda o estado interno e avisa onValueChange', () => {
    const onValueChange = vi.fn();
    const { result } = setup({
      value: { field: 'slug', order: 'desc' },
      onValueChange,
    });

    expect(result.current.sort).toEqual({ field: 'slug', order: 'desc' });

    act(() => result.current.toggleSort('slug'));

    // Quem manda é o `value` de fora — o hook só propõe o próximo estado.
    expect(result.current.sort).toEqual({ field: 'slug', order: 'desc' });
    expect(onValueChange).toHaveBeenCalledWith({ field: 'slug', order: 'asc' });
  });
});

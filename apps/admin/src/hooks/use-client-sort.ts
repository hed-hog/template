'use client';

import { useMemo } from 'react';
import type { SortOrder } from './use-table-sort';

export type ClientSortAccessors<TItem, TField extends string> = Record<
  TField,
  (item: TItem) => string | number | Date | null | undefined
>;

/**
 * Ordena no navegador uma lista que NÃO é paginada no servidor (a API devolve
 * tudo de uma vez). Par do `useTableSort`: ele guarda o campo e a direção, este
 * aplica.
 *
 * ```ts
 * const sort = useTableSort<Field>({ columns: FIELDS, defaultSort: { field: 'name', order: 'asc' } });
 * const items = useClientSort(data, sort.sortField, sort.sortOrder, {
 *   name: (p) => p.name,
 *   client: (p) => p.client?.name,
 *   total: (p) => p.total,
 * });
 * ```
 *
 * Lista paginada no servidor NÃO usa este hook: manda `sortField`/`sortOrder`
 * na requisição, senão a ordenação vale só para a página atual.
 *
 * Texto compara sem caixa e sem acento, com números em ordem natural
 * ("Item 2" antes de "Item 10"). Vazios vão sempre para o fim.
 */
export function useClientSort<TItem, TField extends string>(
  items: readonly TItem[] | null | undefined,
  field: TField,
  order: SortOrder,
  accessors: ClientSortAccessors<TItem, TField>
): TItem[] {
  const accessor = accessors[field];

  return useMemo(() => {
    const list = [...(items ?? [])];
    if (!accessor) return list;
    const direction = order === 'asc' ? 1 : -1;

    return list.sort((a, b) => {
      const left = accessor(a);
      const right = accessor(b);
      const leftEmpty = left === null || left === undefined || left === '';
      const rightEmpty = right === null || right === undefined || right === '';
      if (leftEmpty || rightEmpty) {
        return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
      }
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : left instanceof Date && right instanceof Date
            ? left.getTime() - right.getTime()
            : String(left).localeCompare(String(right), undefined, {
                sensitivity: 'base',
                numeric: true,
              });
      return result * direction;
    });
    // `accessors` costuma ser um objeto literal recriado a cada render; o campo
    // escolhido e os dados são o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, field, order]);
}

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ accessToken: 'token-de-teste', user: { id: 7 } }),
}));

import { useColumnPreferences } from './use-column-preferences';

const CHAVE = 'use-column-preferences-test-v1';
const COLUNAS = ['turma', 'instrutor', 'status'];

const usar = () =>
  renderHook(() =>
    useColumnPreferences({
      storageKey: CHAVE,
      columnIds: COLUNAS,
      defaultHiddenIds: ['instrutor'],
    })
  );

describe('useColumnPreferences — defaultHiddenIds', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sem preferência salva, a coluna nasce oculta', () => {
    const { result } = usar();

    expect(result.current.hidden).toEqual(['instrutor']);
    expect(result.current.visibility).toMatchObject({
      turma: true,
      instrutor: false,
    });
  });

  it('coluna nova nasce oculta para quem já tinha preferência salva', () => {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ order: ['status', 'turma'], hidden: ['status'] })
    );

    const { result } = usar();

    expect(result.current.hidden).toEqual(['status', 'instrutor']);
    expect(result.current.order).toEqual(['status', 'turma', 'instrutor']);
  });

  it('depois de gravada, vale a escolha do usuário', () => {
    window.localStorage.setItem(
      CHAVE,
      JSON.stringify({ order: ['turma', 'instrutor', 'status'], hidden: [] })
    );

    const { result } = usar();

    expect(result.current.hidden).toEqual([]);
  });

  it('mostrar a coluna persiste, e restaurar o padrão volta a escondê-la', () => {
    const { result } = usar();

    act(() => result.current.toggleColumn('instrutor', true));
    expect(result.current.hidden).toEqual([]);
    expect(
      JSON.parse(window.localStorage.getItem(CHAVE) ?? '{}')
    ).toMatchObject({ hidden: [], order: COLUNAS });

    act(() => result.current.reset());
    expect(result.current.hidden).toEqual(['instrutor']);
  });
});

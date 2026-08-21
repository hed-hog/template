import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_SIZES, usePageSizeOptions } from './use-page-size-options';

const getSettingValue = vi.fn();

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ getSettingValue }),
}));

function setup(value: unknown) {
  getSettingValue.mockReturnValue(value);
  return renderHook(() => usePageSizeOptions());
}

describe('usePageSizeOptions', () => {
  it('usa a setting quando ela chega como lista', () => {
    expect(setup(['5', '10', '20']).result.current).toEqual([5, 10, 20]);
  });

  it('aceita a setting serializada como string JSON', () => {
    expect(setup('["10","25"]').result.current).toEqual([10, 25]);
  });

  it('ordena e remove duplicatas', () => {
    expect(setup(['48', '6', '48', '12']).result.current).toEqual([6, 12, 48]);
  });

  it('descarta valores inválidos e mantém o resto', () => {
    expect(setup(['10', 'abc', '0', '-5', '20']).result.current).toEqual([10, 20]);
  });

  it('cai no padrão quando a setting não existe', () => {
    expect(setup(null).result.current).toEqual(DEFAULT_PAGE_SIZES);
  });

  it('cai no padrão quando a string não é JSON válido', () => {
    expect(setup('nao-e-json').result.current).toEqual(DEFAULT_PAGE_SIZES);
  });

  it('cai no padrão quando sobra lista vazia depois do filtro', () => {
    expect(setup(['0', 'x']).result.current).toEqual(DEFAULT_PAGE_SIZES);
  });

  it('mantém a mesma referência entre renders, para não resetar o tamanho salvo', () => {
    const { result, rerender } = setup(['10', '20']);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

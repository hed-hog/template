import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedPageSize } from './use-persisted-page-size';

const ALLOWED = [10, 24, 50] as const;

function setup(stored: string | null, storageKey = 'pp') {
  if (stored === null) localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, stored);
  return renderHook(() =>
    usePersistedPageSize({ storageKey, defaultValue: 10, allowedValues: ALLOWED }),
  );
}

describe('usePersistedPageSize', () => {
  beforeEach(() => localStorage.clear());

  it('usa o default quando não há valor salvo', () => {
    const { result } = setup(null);
    expect(result.current[0]).toBe(10);
  });

  it('lê e valida um valor permitido do localStorage', () => {
    const { result } = setup('24');
    expect(result.current[0]).toBe(24);
  });

  it('cai no default para valores fora da lista permitida', () => {
    expect(setup('999').result.current[0]).toBe(10);
  });

  it('cai no default para valores não-inteiros ou não-positivos', () => {
    expect(setup('abc').result.current[0]).toBe(10);
    expect(setup('-5').result.current[0]).toBe(10);
    expect(setup('0').result.current[0]).toBe(10);
    expect(setup('12.5').result.current[0]).toBe(10);
  });

  it('setPageSize atualiza o estado e persiste um valor permitido', () => {
    const { result } = setup(null, 'k1');
    act(() => result.current[1](50));
    expect(result.current[0]).toBe(50);
    expect(localStorage.getItem('k1')).toBe('50');
  });

  it('setPageSize com valor não permitido volta ao default', () => {
    const { result } = setup('24', 'k2');
    act(() => result.current[1](7));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem('k2')).toBe('10');
  });

  describe('falhas de acesso ao localStorage', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('estado inicial ignora falha do localStorage.getItem e cai no default', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      const { result } = renderHook(() =>
        usePersistedPageSize({ storageKey: 'kk0', defaultValue: 10, allowedValues: ALLOWED }),
      );

      expect(result.current[0]).toBe(10);
    });

    it('effect de releitura ignora falha do localStorage.getItem e cai no default', () => {
      const { result, rerender } = renderHook(
        ({ storageKey }) =>
          usePersistedPageSize({ storageKey, defaultValue: 10, allowedValues: ALLOWED }),
        { initialProps: { storageKey: 'kk1' } },
      );

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      // Changing storageKey re-runs the effect with the mocked getItem.
      rerender({ storageKey: 'kk2' });

      expect(result.current[0]).toBe(10);
    });

    it('setPageSize ignora falha do localStorage.setItem', () => {
      const { result } = setup(null, 'kk3');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => act(() => result.current[1](50))).not.toThrow();
      expect(result.current[0]).toBe(50);
    });
  });
});

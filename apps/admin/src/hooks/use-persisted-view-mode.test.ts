import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { usePersistedViewMode } from './use-persisted-view-mode';

const allowed = ['cards', 'list'] as const;

function setup(storageKey = 'vm') {
  return renderHook(() =>
    usePersistedViewMode({
      storageKey,
      defaultValue: 'cards' as const,
      allowedValues: allowed,
    })
  );
}

describe('usePersistedViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inicia no defaultValue', () => {
    const { result } = setup();
    expect(result.current[0]).toBe('cards');
  });

  it('hidrata com valor válido do localStorage após o mount', async () => {
    localStorage.setItem('vm', 'list');
    const { result } = setup();
    await waitFor(() => expect(result.current[0]).toBe('list'));
  });

  it('ignora valor inválido armazenado e mantém o default', async () => {
    localStorage.setItem('vm', 'grid-3d');
    const { result } = setup();
    // gives time for the effect's setTimeout(0) to run
    await waitFor(() => {});
    expect(result.current[0]).toBe('cards');
  });

  it('setViewMode persiste valor válido no localStorage', async () => {
    const { result } = setup();
    act(() => result.current[1]('list'));
    expect(result.current[0]).toBe('list');
    expect(localStorage.getItem('vm')).toBe('list');
    await waitFor(() => expect(result.current[0]).toBe('list'));
  });

  it('setViewMode com valor inválido cai no default', () => {
    const { result } = setup();
    act(() => result.current[1]('nope' as unknown as (typeof allowed)[number]));
    expect(result.current[0]).toBe('cards');
  });

  describe('falhas de acesso ao localStorage', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('effect ignora falha do localStorage.getItem e cai no default', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });

      const { result } = setup();
      await waitFor(() => {});
      expect(result.current[0]).toBe('cards');
    });

    it('setViewMode ignora falha do localStorage.setItem', () => {
      const { result } = setup();

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => act(() => result.current[1]('list'))).not.toThrow();
      expect(result.current[0]).toBe('list');
    });
  });
});

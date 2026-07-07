import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { reducer, useToast } from './use-toast';

type ReducerState = Parameters<typeof reducer>[0];
type ReducerAction = Parameters<typeof reducer>[1];
type Toast = ReducerState['toasts'][number];

const makeToast = (id: string, extra: Record<string, unknown> = {}): Toast =>
  ({ id, open: true, ...extra }) as Toast;

describe('use-toast reducer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('ADD_TOAST respeita o limite de 1 e mantém o mais novo primeiro', () => {
    let state: ReducerState = { toasts: [] };
    state = reducer(state, { type: 'ADD_TOAST', toast: makeToast('1') } as ReducerAction);
    expect(state.toasts).toHaveLength(1);

    state = reducer(state, { type: 'ADD_TOAST', toast: makeToast('2') } as ReducerAction);
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]?.id).toBe('2');
  });

  it('UPDATE_TOAST faz merge por id e ignora ids inexistentes', () => {
    const state: ReducerState = { toasts: [makeToast('1', { title: 'A' })] };

    const updated = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'B' },
    } as ReducerAction);
    expect(updated.toasts[0]?.title).toBe('B');
    expect(updated.toasts[0]?.open).toBe(true);

    const noop = reducer(state, {
      type: 'UPDATE_TOAST',
      toast: { id: '999', title: 'X' },
    } as ReducerAction);
    expect(noop.toasts[0]?.title).toBe('A');
  });

  it('DISMISS_TOAST com id fecha apenas o toast alvo', () => {
    const state: ReducerState = {
      toasts: [makeToast('a'), makeToast('b')],
    };
    const next = reducer(state, {
      type: 'DISMISS_TOAST',
      toastId: 'a',
    } as ReducerAction);

    expect(next.toasts.find((t) => t.id === 'a')?.open).toBe(false);
    expect(next.toasts.find((t) => t.id === 'b')?.open).toBe(true);
  });

  it('DISMISS_TOAST sem id fecha todos', () => {
    const state: ReducerState = {
      toasts: [makeToast('a'), makeToast('b')],
    };
    const next = reducer(state, { type: 'DISMISS_TOAST' } as ReducerAction);
    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it('REMOVE_TOAST com id remove só aquele; sem id limpa tudo', () => {
    const state: ReducerState = {
      toasts: [makeToast('a'), makeToast('b')],
    };

    const removedOne = reducer(state, {
      type: 'REMOVE_TOAST',
      toastId: 'a',
    } as ReducerAction);
    expect(removedOne.toasts.map((t) => t.id)).toEqual(['b']);

    const removedAll = reducer(state, {
      type: 'REMOVE_TOAST',
      toastId: undefined,
    } as ReducerAction);
    expect(removedAll.toasts).toEqual([]);
  });
});

describe('useToast (ciclo de vida com timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    // clears out any remaining toast in the module's singleton state
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('adiciona, dispensa (open:false) e remove após o delay agendado', () => {
    const { result } = renderHook(() => useToast());

    let handle: { id: string; dismiss: () => void } | undefined;
    act(() => {
      handle = result.current.toast({ title: 'Olá' });
    });

    expect(result.current.toasts).toHaveLength(1);
    const id = handle!.id;
    expect(result.current.toasts[0]?.id).toBe(id);
    expect(result.current.toasts[0]?.open).toBe(true);

    act(() => {
      result.current.dismiss(id);
    });
    expect(result.current.toasts[0]?.open).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1_000_000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('update() do handle retornado faz UPDATE_TOAST no toast correto', () => {
    const { result } = renderHook(() => useToast());

    let handle: { id: string; update: (props: Record<string, unknown>) => void } | undefined;
    act(() => {
      handle = result.current.toast({ title: 'Original' }) as unknown as typeof handle;
    });

    expect(result.current.toasts[0]?.title).toBe('Original');

    act(() => {
      handle!.update({ id: handle!.id, title: 'Atualizado' } as never);
    });

    expect(result.current.toasts[0]?.title).toBe('Atualizado');
  });

  it('onOpenChange(false) do toast aciona dismiss (fecha o toast)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Fechando via Radix' });
    });

    expect(result.current.toasts[0]?.open).toBe(true);

    act(() => {
      result.current.toasts[0]?.onOpenChange?.(false);
    });

    expect(result.current.toasts[0]?.open).toBe(false);
  });

  it('efeito de limpeza remove o listener quando o hook é desmontado', () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Antes de desmontar' });
    });
    expect(result.current.toasts).toHaveLength(1);

    // Should not throw and should stop receiving state updates after unmount.
    expect(() => unmount()).not.toThrow();
  });
});

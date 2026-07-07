import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  afterEach(() => vi.useRealTimers());

  it('retorna o valor inicial imediatamente', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebounce('a', 500));
    expect(result.current).toBe('a');
  });

  it('só atualiza após o delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // delay hasn't elapsed yet

    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('reinicia o timer a cada mudança rápida (só o último valor vinga)', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: 'c' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a'); // no full delay has elapsed yet

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });

  it('usa o delay padrão (DEBOUNCE_MILLISECONDS = 500)', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(2);
  });
});

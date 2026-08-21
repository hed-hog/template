import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './use-mobile';

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initialMatches,
    media: '',
    addEventListener: (_event: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_event: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql)
  );
  return { trigger: () => listeners.forEach((cb) => cb()) };
}

describe('useIsMobile', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('retorna true quando a largura da janela é menor que o breakpoint móvel', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    });
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('retorna false quando a largura da janela é maior ou igual ao breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('atualiza o valor quando o listener de mudança de media query é disparado', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    const { trigger } = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 400,
      });
      trigger();
    });

    expect(result.current).toBe(true);
  });

  it('remove o listener ao desmontar', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    mockMatchMedia(false);

    const { unmount } = renderHook(() => useIsMobile());
    expect(() => unmount()).not.toThrow();
  });
});

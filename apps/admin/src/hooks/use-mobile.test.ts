import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

function mockMatchMedia(width: number) {
  const listeners: Array<() => void> = [];
  window.innerWidth = width;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: width < 768,
    media: query,
    addEventListener: (_event: string, listener: () => void) => {
      listeners.push(listener);
    },
    removeEventListener: vi.fn(),
  }));
  return {
    fireChange: (newWidth: number) => {
      window.innerWidth = newWidth;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.innerWidth = originalInnerWidth;
  });

  it('retorna true quando a largura inicial é menor que o breakpoint mobile', () => {
    mockMatchMedia(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('retorna false quando a largura inicial é maior ou igual ao breakpoint mobile', () => {
    mockMatchMedia(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('atualiza quando o listener de "change" dispara', () => {
    const { fireChange } = mockMatchMedia(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      fireChange(400);
    });
    expect(result.current).toBe(true);
  });

  it('remove o listener ao desmontar', () => {
    mockMatchMedia(1024);
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

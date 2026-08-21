import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useThemeMode } from './use-theme-mode';

const root = document.documentElement;

describe('useThemeMode', () => {
  // Reset only in beforeEach (no hook mounted yet), avoiding triggering the
  // MutationObserver of a hook already mounted outside act().
  beforeEach(() => root.classList.remove('dark'));

  it('sem a classe dark no <html> resolve como "light"', () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe('light');
  });

  it('já montado com a classe dark resolve como "dark"', () => {
    root.classList.add('dark');
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe('dark');
  });

  it('reage a adicionar a classe dark via MutationObserver', async () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe('light');

    // The setTimeout ensures the MutationObserver microtask runs while the
    // act() environment is still active, avoiding an update-outside-act warning.
    await act(async () => {
      root.classList.add('dark');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe('dark');
  });

  it('reage a remover a classe dark', async () => {
    root.classList.add('dark');
    const { result } = renderHook(() => useThemeMode());
    expect(result.current).toBe('dark');

    await act(async () => {
      root.classList.remove('dark');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current).toBe('light');
  });

  it('desmontar não lança e para de observar', () => {
    const { unmount } = renderHook(() => useThemeMode());
    expect(() => {
      unmount();
      root.classList.add('dark');
    }).not.toThrow();
  });
});

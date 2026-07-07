import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockTheme: { theme?: string } = { theme: undefined };

vi.mock('next-themes', () => ({
  useTheme: () => mockTheme,
}));

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="sonner-toaster" data-theme={String(props.theme)} />
  ),
}));

import { Toaster } from './sonner';

describe('Toaster (sonner)', () => {
  it('usa o tema "system" por padrão quando next-themes não define um tema', () => {
    mockTheme = {};
    render(<Toaster />);
    expect(screen.getByTestId('sonner-toaster')).toHaveAttribute('data-theme', 'system');
  });

  it('repassa o tema atual do next-themes', () => {
    mockTheme = { theme: 'dark' };
    render(<Toaster />);
    expect(screen.getByTestId('sonner-toaster')).toHaveAttribute('data-theme', 'dark');
  });

  it('repassa props adicionais para o componente Sonner', () => {
    mockTheme = { theme: 'light' };
    render(<Toaster position="top-right" />);
    expect(screen.getByTestId('sonner-toaster')).toBeInTheDocument();
  });
});

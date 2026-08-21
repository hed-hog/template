import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Toggle, toggleVariants } from './toggle';

describe('Toggle', () => {
  it('renderiza com variantes e tamanhos padrão', () => {
    render(<Toggle aria-label="negrito">B</Toggle>);
    const el = screen.getByRole('button', { name: 'negrito' });
    expect(el).toHaveAttribute('data-slot', 'toggle');
    expect(el).toHaveClass('bg-transparent');
    expect(el).toHaveClass('h-9');
  });

  it('aplica a variante outline', () => {
    render(
      <Toggle aria-label="itálico" variant="outline">
        I
      </Toggle>
    );
    expect(screen.getByRole('button', { name: 'itálico' })).toHaveClass('border-input');
  });

  it.each([
    ['sm', 'h-8'],
    ['lg', 'h-10'],
  ] as const)('aplica o tamanho %s', (size, expectedClass) => {
    render(
      <Toggle aria-label={`toggle-${size}`} size={size}>
        X
      </Toggle>
    );
    expect(screen.getByRole('button', { name: `toggle-${size}` })).toHaveClass(expectedClass);
  });

  it('alterna o estado pressed ao clicar', () => {
    const onPressedChange = vi.fn();
    render(
      <Toggle aria-label="favorito" onPressedChange={onPressedChange}>
        Star
      </Toggle>
    );
    const el = screen.getByRole('button', { name: 'favorito' });
    fireEvent.click(el);
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it('toggleVariants gera classes previsíveis', () => {
    expect(toggleVariants({ variant: 'outline', size: 'lg' })).toContain('border-input');
  });
});

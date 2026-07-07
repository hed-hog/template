import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renderiza a variante e tamanho default', () => {
    render(<Button>Clique</Button>);
    const button = screen.getByRole('button', { name: 'Clique' });
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('h-9');
  });

  it.each([
    ['default', 'bg-primary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'bg-background'],
    ['secondary', 'bg-secondary'],
    ['ghost', 'hover:bg-accent'],
    ['link', 'text-primary'],
  ] as const)('renderiza a variante %s', (variant, expectedClass) => {
    render(<Button variant={variant}>Botão</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it.each([
    ['default', 'h-9'],
    ['sm', 'h-8'],
    ['lg', 'h-10'],
    ['icon', 'size-9'],
    ['icon-sm', 'size-8'],
    ['icon-lg', 'size-10'],
  ] as const)('renderiza o tamanho %s', (size, expectedClass) => {
    render(<Button size={size}>Botão</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('renderiza como Slot quando asChild é true', () => {
    render(
      <Button asChild>
        <a href="/link">Link</a>
      </Button>,
    );
    const link = screen.getByText('Link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('data-slot', 'button');
  });

  it('dispara onClick ao ser clicado', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clique</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('exporta buttonVariants como função utilitária de classes', () => {
    expect(buttonVariants({ variant: 'outline', size: 'sm' })).toContain('border');
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renderiza a variante default', () => {
    render(<Badge>Novo</Badge>);
    const badge = screen.getByText('Novo');
    expect(badge).toHaveClass('bg-primary');
  });

  it('renderiza a variante secondary', () => {
    render(<Badge variant="secondary">Secundário</Badge>);
    expect(screen.getByText('Secundário')).toHaveClass('bg-secondary');
  });

  it('renderiza a variante destructive', () => {
    render(<Badge variant="destructive">Erro</Badge>);
    expect(screen.getByText('Erro')).toHaveClass('bg-destructive');
  });

  it('renderiza a variante outline', () => {
    render(<Badge variant="outline">Contorno</Badge>);
    expect(screen.getByText('Contorno')).toHaveClass('text-foreground');
  });

  it('renderiza como Slot quando asChild é true', () => {
    render(
      <Badge asChild>
        <a href="/link">Link</a>
      </Badge>,
    );
    const link = screen.getByText('Link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('data-slot', 'badge');
  });
});

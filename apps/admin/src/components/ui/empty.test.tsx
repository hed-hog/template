import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './empty';

describe('Empty (compound)', () => {
  it('renderiza a composição completa com variant padrão (default) do EmptyMedia', () => {
    render(
      <Empty className="empty-root">
        <EmptyHeader>
          <EmptyMedia>
            <svg data-testid="icon" />
          </EmptyMedia>
          <EmptyTitle>Sem resultados</EmptyTitle>
          <EmptyDescription>Ajuste os filtros</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <button type="button">Ação</button>
        </EmptyContent>
      </Empty>
    );

    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
    expect(screen.getByText('Ajuste os filtros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ação' })).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    const media = screen.getByTestId('icon').closest('[data-slot="empty-icon"]');
    expect(media).toHaveAttribute('data-variant', 'default');
  });

  it('renderiza EmptyMedia com variant "icon"', () => {
    render(
      <EmptyMedia variant="icon" data-testid="media-icon">
        <svg />
      </EmptyMedia>
    );

    const media = screen.getByTestId('media-icon');
    expect(media).toHaveAttribute('data-variant', 'icon');
  });
});

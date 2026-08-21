import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renderiza ícone e título, sem descrição e sem ação', () => {
    render(<EmptyState icon={<span data-testid="icon" />} title="Nada encontrado" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Nada encontrado')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renderiza descrição quando informada', () => {
    render(
      <EmptyState
        icon={<span />}
        title="Título"
        description="Uma descrição qualquer"
      />
    );
    expect(screen.getByText('Uma descrição qualquer')).toBeInTheDocument();
  });

  it('não renderiza o botão quando falta actionLabel', () => {
    render(<EmptyState icon={<span />} title="Título" onAction={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('não renderiza o botão quando falta onAction', () => {
    render(<EmptyState icon={<span />} title="Título" actionLabel="Criar" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renderiza o botão de ação com ícone e dispara onAction ao clicar', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={<span />}
        title="Título"
        actionLabel="Criar novo"
        actionIcon={<span data-testid="action-icon" />}
        onAction={onAction}
      />
    );
    expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /criar novo/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('aplica className adicional ao container', () => {
    const { container } = render(
      <EmptyState icon={<span />} title="Título" className="custom-class" />
    );
    expect((container.firstChild as HTMLElement).className).toContain(
      'custom-class'
    );
  });
});

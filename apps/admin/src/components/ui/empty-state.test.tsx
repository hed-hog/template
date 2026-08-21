import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renderiza o ícone padrão (Inbox), título e sem descrição/ação', () => {
    const { container } = render(<EmptyState title="Nada encontrado" />);

    expect(screen.getByText('Nada encontrado')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText(/descrição/i)).not.toBeInTheDocument();
  });

  it('renderiza descrição e ação quando informadas, com ícone customizado e className', () => {
    function CustomIcon(props: React.ComponentProps<'svg'>) {
      return <svg data-testid="custom-icon" {...props} />;
    }

    render(
      <EmptyState
        icon={CustomIcon}
        title="Sem itens"
        description="Tente novamente mais tarde"
        action={<button type="button">Recarregar</button>}
        className="custom-class"
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Sem itens')).toBeInTheDocument();
    expect(screen.getByText('Tente novamente mais tarde')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recarregar' })
    ).toBeInTheDocument();
  });
});

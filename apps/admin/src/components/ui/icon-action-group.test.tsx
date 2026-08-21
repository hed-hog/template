import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { IconActionGroup } from './icon-action-group';

describe('IconActionGroup', () => {
  it('renderiza uma ação com label string e dispara onClick sem propagar o evento', () => {
    const onClick = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <IconActionGroup
          actions={[
            { key: 'edit', label: 'Editar', icon: <span>icon</span>, onClick },
          ]}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('usa a key como aria-label quando o label não é string nem number', () => {
    render(
      <IconActionGroup
        actions={[
          {
            key: 'custom-action',
            label: <span>Rótulo em nó</span>,
            icon: <span>icon</span>,
            onClick: () => {},
          },
        ]}
      />
    );

    expect(
      screen.getByRole('button', { name: 'custom-action' })
    ).toBeInTheDocument();
  });

  it('aceita label numérico, aplica estilos destrutivos e desabilita o botão', () => {
    render(
      <IconActionGroup
        actions={[
          {
            key: 'count',
            label: 42,
            icon: <span>icon</span>,
            onClick: () => {},
            destructive: true,
            disabled: true,
            side: 'right',
          },
        ]}
        className="extra-group-class"
        buttonClassName="extra-button-class"
      />
    );

    const button = screen.getByRole('button', { name: '42' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('text-destructive');
    expect(button).toHaveClass('extra-button-class');
  });

  it('usa a key como label do tooltip quando label é undefined', () => {
    render(
      <IconActionGroup
        actions={[
          {
            key: 'no-label',
            label: undefined,
            icon: <span>icon</span>,
            onClick: () => {},
          },
        ]}
      />
    );

    expect(
      screen.getByRole('button', { name: 'no-label' })
    ).toBeInTheDocument();
  });

  it('renderiza múltiplas ações', () => {
    render(
      <IconActionGroup
        actions={[
          { key: 'a', label: 'A', icon: <span /> , onClick: () => {} },
          { key: 'b', label: 'B', icon: <span />, onClick: () => {} },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });
});

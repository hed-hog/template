import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { type ReactNode } from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { SortableTableHead } from './sortable-table-head';

function renderHead(
  props: Partial<React.ComponentProps<typeof SortableTableHead>> = {}
): { onSort: ReturnType<typeof vi.fn> } {
  const onSort = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <table>
      <thead>
        <tr>{children}</tr>
      </thead>
    </table>
  );
  render(
    wrapper({
      children: (
        <SortableTableHead
          label="Nome"
          sortDirection={null}
          onSort={onSort}
          {...props}
        />
      ),
    })
  );
  return { onSort };
}

describe('SortableTableHead', () => {
  it('sem onSort degrada para cabeçalho puro: nenhum botão e nenhum aria-sort', () => {
    renderHead({ onSort: undefined, sortDirection: undefined });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader')).not.toHaveAttribute('aria-sort');
    expect(screen.getByRole('columnheader')).toHaveTextContent('Nome');
  });

  it('coluna ordenável mas inativa expõe aria-sort="none" e um botão', () => {
    renderHead({ sortDirection: null });

    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'none'
    );
    expect(screen.getByRole('button', { name: 'Nome' })).toBeInTheDocument();
  });

  it('sortDirection asc vira aria-sort="ascending"', () => {
    renderHead({ sortDirection: 'asc' });

    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
  });

  it('sortDirection desc vira aria-sort="descending"', () => {
    renderHead({ sortDirection: 'desc' });

    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  });

  it('clicar no cabeçalho dispara onSort uma vez', () => {
    const { onSort } = renderHead({ sortDirection: null });

    fireEvent.click(screen.getByRole('button', { name: 'Nome' }));

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('align="right" alinha a célula à direita', () => {
    renderHead({ align: 'right', sortDirection: null });

    expect(screen.getByRole('columnheader')).toHaveClass('text-right');
  });

  it('preserva a className recebida', () => {
    renderHead({ className: 'w-40', sortDirection: null });

    expect(screen.getByRole('columnheader')).toHaveClass('w-40');
  });
});

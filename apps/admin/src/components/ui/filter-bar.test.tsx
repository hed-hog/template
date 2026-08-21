import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Radix Select requires portal/pointer-capture behavior that's unnecessary to
// exercise here; replace with plain passthroughs so we can trigger onValueChange
// deterministically, mirroring the repo's established mocking convention.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button
        type="button"
        data-testid="select-change"
        onClick={() => onValueChange?.('active')}
      >
        change
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
}));

import { FilterBar } from './filter-bar';

describe('FilterBar', () => {
  it('renderiza com valores padrão: sem filtros e sem botão de limpar', () => {
    render(<FilterBar />);

    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
    expect(screen.queryByTestId('select')).not.toBeInTheDocument();
    expect(screen.queryByText(/Limpar/)).not.toBeInTheDocument();
  });

  it('propaga a busca via onSearchChange', () => {
    const onSearchChange = vi.fn();
    render(
      <FilterBar
        searchPlaceholder="Buscar pessoas"
        searchValue=""
        onSearchChange={onSearchChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar pessoas'), {
      target: { value: 'ana' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('ana');
  });

  it('renderiza filtros com opções e propaga a mudança de valor', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: 'inactive',
            onChange,
            options: [
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-change'));
    expect(onChange).toHaveBeenCalledWith('active');
  });

  it('exibe o botão de limpar quando há filtros ativos e propaga onClearFilters', () => {
    const onClearFilters = vi.fn();
    render(<FilterBar activeFilters={2} onClearFilters={onClearFilters} />);

    const clearButton = screen.getByRole('button', { name: /Limpar \(2\)/ });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

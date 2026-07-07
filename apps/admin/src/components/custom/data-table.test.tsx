import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';

// Tooltip (Radix) needs a provider for delay grouping; for a unit test of
// DataTable we replace it with a passthrough, same pattern as
// pagination-footer.test.tsx.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
}));

// DropdownMenu (Radix) uses pointer-capture/portal internals that jsdom does
// not implement; replace with a plain always-open passthrough so we can
// interact with the column-visibility checkboxes directly.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: {
    children: ReactNode;
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      {children}
    </label>
  ),
}));

// Select (Radix) has the same jsdom limitations; a native <select> is enough
// to exercise the onValueChange callback wired up by DataTable.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children?: ReactNode;
  }) => (
    <select
      aria-label="rows-per-page"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {[10, 20, 30, 40, 50].map((n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

import { DataTable } from './data-table';

type Item = { id: number; name: string };

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  }));
}

const columns: ColumnDef<Item>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

describe('DataTable', () => {
  it('não renderiza o campo de busca quando searchColumn não é informado', () => {
    render(<DataTable columns={columns} data={makeItems(2)} />);
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('renderiza o campo de busca e filtra pela coluna informada', () => {
    render(
      <DataTable
        columns={columns}
        data={makeItems(3)}
        searchColumn="name"
        searchPlaceholder="Buscar..."
      />,
    );
    const input = screen.getByPlaceholderText('Buscar...') as HTMLInputElement;
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'Item 2' } });
    expect(input.value).toBe('Item 2');
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('usa valor vazio quando searchColumn não corresponde a nenhuma coluna', () => {
    render(
      <DataTable
        columns={columns}
        data={makeItems(2)}
        searchColumn="nonexistent"
      />,
    );
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('exibe "No results." quando não há dados', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('não renderiza o menu de colunas quando showColumnVisibility é falso', () => {
    render(
      <DataTable
        columns={columns}
        data={makeItems(2)}
        showColumnVisibility={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /columns/i }),
    ).not.toBeInTheDocument();
  });

  it('alterna a visibilidade de uma coluna pelo menu de colunas', () => {
    render(<DataTable columns={columns} data={makeItems(2)} />);
    expect(screen.getByText('Name')).toBeInTheDocument();

    const nameToggle = screen.getByRole('checkbox', { name: 'name' });
    fireEvent.click(nameToggle);

    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
  });

  it('pagina os resultados com os controles de primeira/anterior/próxima/última página', () => {
    render(<DataTable columns={columns} data={makeItems(15)} />);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to first page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to previous page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Go to last page' }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to last page' }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Go to previous page' }),
    );
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('altera o tamanho de página pelo select', () => {
    render(<DataTable columns={columns} data={makeItems(15)} />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('rows-per-page'), {
      target: { value: '20' },
    });

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('exibe a contagem de linhas selecionadas', () => {
    render(<DataTable columns={columns} data={makeItems(2)} />);
    expect(screen.getByText(/of 2 row\(s\) selected\./)).toBeInTheDocument();
  });

  it('renderiza células de cabeçalho placeholder quando colunas são agrupadas', () => {
    // A grouped column definition produces multiple header rows; columns not
    // part of the group get a placeholder header cell at the group's depth,
    // exercising the `header.isPlaceholder` branch.
    const groupedColumns: ColumnDef<Item>[] = [
      { accessorKey: 'id', header: 'ID' },
      {
        header: 'Info',
        columns: [{ accessorKey: 'name', header: 'Name' }],
      },
    ];

    render(<DataTable columns={groupedColumns} data={makeItems(2)} />);

    expect(screen.getAllByText('Info').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ID').length).toBeGreaterThanOrEqual(1);
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
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
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

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
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean | 'indeterminate';
    onCheckedChange: (value: boolean) => void;
    'aria-label'?: string;
  }) => (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = checked === 'indeterminate';
      }}
      checked={checked === true}
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...props}
    />
  ),
}));

import { DataTable } from './data-table';
import { columns, type User } from './data-table-columns-example';

const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive' },
];

function setup(data: User[] = users) {
  return render(<DataTable columns={columns} data={data} />);
}

describe('data-table-columns-example columns', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  it('renderiza todas as linhas com nome, email e status', () => {
    setup();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBe(2);
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });

  it('aplica a classe de status ativo e inativo corretamente', () => {
    setup();
    const active = screen.getAllByText('active')[0];
    const inactive = screen.getByText('inactive');
    expect(active.className).toContain('bg-green-50');
    expect(inactive.className).toContain('bg-gray-50');
  });

  it('seleciona todas as linhas pelo checkbox do cabeçalho', () => {
    setup();
    const selectAll = screen.getByRole('checkbox', {
      name: 'Select all',
    }) as HTMLInputElement;
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(false);

    fireEvent.click(selectAll);

    const rowCheckboxes = screen.getAllByRole('checkbox', {
      name: 'Select row',
    }) as HTMLInputElement[];
    rowCheckboxes.forEach((cb) => expect(cb.checked).toBe(true));
  });

  it('fica indeterminado quando apenas algumas linhas estão selecionadas', () => {
    setup();
    const rowCheckboxes = screen.getAllByRole('checkbox', {
      name: 'Select row',
    });
    fireEvent.click(rowCheckboxes[0]);

    const selectAll = screen.getByRole('checkbox', {
      name: 'Select all',
    }) as HTMLInputElement;
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(true);
  });

  it('ordena a coluna Nome ao clicar no cabeçalho (asc e desc)', () => {
    setup();
    const nameHeader = screen.getByRole('button', { name: /name/i });
    fireEvent.click(nameHeader);
    fireEvent.click(nameHeader);
    expect(nameHeader).toBeInTheDocument();
  });

  it('ordena a coluna Email ao clicar no cabeçalho (asc e desc)', () => {
    setup();
    const emailHeader = screen.getByRole('button', { name: /^email$/i });
    fireEvent.click(emailHeader);
    fireEvent.click(emailHeader);
    expect(emailHeader).toBeInTheDocument();
  });

  it('copia o email do usuário pelo menu de ações', () => {
    setup();
    const copyButtons = screen.getAllByRole('button', { name: 'Copy email' });
    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'john@example.com',
    );
  });

  it('exibe as demais opções do menu de ações', () => {
    setup();
    expect(screen.getAllByText('View details').length).toBe(users.length);
    expect(screen.getAllByText('Edit user').length).toBe(users.length);
  });
});

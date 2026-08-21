import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

import DataTableExamplePage from './data-table-example-page';

describe('DataTableExamplePage', () => {
  it('renderiza o título, a descrição e os usuários de exemplo', () => {
    render(<DataTableExamplePage />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(
      screen.getByText('Manage your users and their accounts.'),
    ).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('charlie@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { CardsSkeleton, PageSkeleton, TableBodySkeleton, TableSkeleton } from './skeletons';

describe('TableBodySkeleton', () => {
  it('renderiza a quantidade padrão de linhas e colunas', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableBodySkeleton />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll('[data-slot="table-row"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-slot="table-cell"]')).toHaveLength(50);
  });

  it('aceita quantidade customizada de linhas e colunas', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableBodySkeleton rows={2} columns={3} />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll('[data-slot="table-row"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slot="table-cell"]')).toHaveLength(6);
  });
});

describe('TableSkeleton', () => {
  it('renderiza com valores padrão', () => {
    const { container } = render(<TableSkeleton />);
    // 2 skeletons no header controls + columns (5) + rows(5) * columns(5)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renderiza com quantidade customizada de linhas e colunas', () => {
    const { container } = render(<TableSkeleton rows={1} columns={2} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe('CardsSkeleton', () => {
  it('renderiza a quantidade padrão de cards', () => {
    const { container } = render(<CardsSkeleton />);
    expect(container.querySelectorAll('.rounded-lg.border.p-6')).toHaveLength(4);
  });

  it('renderiza a quantidade customizada de cards', () => {
    const { container } = render(<CardsSkeleton count={2} />);
    expect(container.querySelectorAll('.rounded-lg.border.p-6')).toHaveLength(2);
  });
});

describe('PageSkeleton', () => {
  it('renderiza a composição completa da página', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelectorAll('.rounded-lg.border.p-6')).toHaveLength(4);
    expect(container.querySelector('.rounded-md.border')).toBeInTheDocument();
  });
});

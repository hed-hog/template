import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// next-intl needs i18n context; we mock t() to return the key.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// The Tooltip (Radix) requires TooltipProvider; for a unit test of the footer,
// we replace it with a passthrough — TooltipTrigger asChild renders the Button.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { PaginationFooter } from './pagination-footer';

function setup(props: Partial<React.ComponentProps<typeof PaginationFooter>> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <PaginationFooter
      currentPage={1}
      pageSize={12}
      totalItems={25}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...props}
    />,
  );
  return { onPageChange, onPageSizeChange };
}

describe('PaginationFooter', () => {
  it('mostra a página atual e o total de páginas', () => {
    setup(); // 25 items / 12 per page → 3 pages
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  it('desabilita "anterior" na primeira página e habilita "próxima"', () => {
    setup();
    expect(screen.getByRole('button', { name: 'goToPreviousPage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'goToNextPage' })).toBeEnabled();
  });

  it('navega para a próxima página ao clicar', () => {
    const { onPageChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'goToNextPage' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('clampa a página atual acima do total ao último válido', () => {
    const { onPageChange } = setup({ currentPage: 99 });
    // safeCurrentPage = 3; "next" is disabled, "previous" is enabled
    expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'goToPreviousPage' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('troca o tamanho de página pelo select', () => {
    const { onPageSizeChange } = setup();
    fireEvent.change(screen.getByLabelText('itemsPerPage'), { target: { value: '24' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(24);
  });

  it('não chama onPageSizeChange quando o valor selecionado é igual ao atual', () => {
    const { onPageSizeChange } = setup({ pageSize: 12 });
    fireEvent.change(screen.getByLabelText('itemsPerPage'), { target: { value: '12' } });
    expect(onPageSizeChange).not.toHaveBeenCalled();
  });

  it('mostra o total de itens quando nada está selecionado', () => {
    setup({ selectedCount: 0, totalItems: 25 });
    expect(screen.getByText('totalItems')).toBeInTheDocument();
  });

  it('mostra a contagem de itens selecionados quando selectedCount > 0', () => {
    setup({ selectedCount: 3, totalItems: 25 });
    expect(screen.getByText('selectedItems')).toBeInTheDocument();
  });

  it('navega para a primeira página ao clicar em "goToFirstPage"', () => {
    const { onPageChange } = setup({ currentPage: 3, totalItems: 25, pageSize: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'goToFirstPage' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('navega para a última página ao clicar em "goToLastPage"', () => {
    const { onPageChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'goToLastPage' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('desabilita "primeira" e "última" página quando aplicável', () => {
    setup({ currentPage: 1, totalItems: 25, pageSize: 12 });
    expect(screen.getByRole('button', { name: 'goToFirstPage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'goToLastPage' })).toBeEnabled();
  });
});

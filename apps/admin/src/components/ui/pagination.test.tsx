import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination';

describe('Pagination', () => {
  it('renderiza a navegação com role e aria-label corretos', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    expect(screen.getByRole('navigation', { name: 'pagination' })).toBeInTheDocument();
  });

  it('marca o link como ativo quando isActive é true', () => {
    render(
      <PaginationContent>
        <PaginationLink href="#" isActive>
          2
        </PaginationLink>
      </PaginationContent>,
    );

    const link = screen.getByText('2');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveAttribute('data-active', 'true');
  });

  it('não marca o link como ativo por padrão (isActive false/undefined)', () => {
    render(
      <PaginationContent>
        <PaginationLink href="#">3</PaginationLink>
      </PaginationContent>,
    );

    const link = screen.getByText('3');
    expect(link).not.toHaveAttribute('aria-current');
    expect(link).not.toHaveAttribute('data-active');
  });

  it('renderiza o botão "anterior" com texto e ícone', () => {
    render(
      <PaginationContent>
        <PaginationPrevious href="#" />
      </PaginationContent>,
    );

    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('renderiza o botão "próxima" com texto e ícone', () => {
    render(
      <PaginationContent>
        <PaginationNext href="#" />
      </PaginationContent>,
    );

    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renderiza a elipse com texto acessível oculto', () => {
    render(<PaginationEllipsis />);

    expect(screen.getByText('More pages')).toBeInTheDocument();
  });
});

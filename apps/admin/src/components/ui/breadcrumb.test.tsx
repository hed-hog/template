import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

describe('Breadcrumb', () => {
  it('renderiza a estrutura completa com separador padrão (ChevronRight)', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Início</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Atual</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Atual')).toHaveAttribute('aria-current', 'page');
  });

  it('renderiza BreadcrumbLink como Slot quando asChild é true', () => {
    render(
      <BreadcrumbLink asChild>
        <a href="/custom">Custom</a>
      </BreadcrumbLink>,
    );
    const link = screen.getByText('Custom');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('data-slot', 'breadcrumb-link');
  });

  it('renderiza um separador customizado quando children é fornecido', () => {
    render(<BreadcrumbSeparator>/</BreadcrumbSeparator>);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renderiza BreadcrumbEllipsis com texto acessível', () => {
    render(<BreadcrumbEllipsis />);
    expect(screen.getByText('More')).toBeInTheDocument();
  });
});

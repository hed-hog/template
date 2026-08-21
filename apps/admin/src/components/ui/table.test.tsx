import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

describe('Table', () => {
  it('renderiza a composição completa com todos os slots', () => {
    render(
      <Table data-testid="table" className="table-class">
        <TableCaption>Legenda</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Rodapé</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    expect(screen.getByTestId('table')).toHaveClass('table-class');
    expect(screen.getByText('Legenda')).toBeInTheDocument();
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Rodapé')).toBeInTheDocument();

    expect(screen.getByTestId('table').closest('[data-slot="table-container"]')).toBeInTheDocument();
    expect(screen.getByText('Nome').closest('[data-slot="table-head"]')).toBeInTheDocument();
    expect(screen.getByText('Alice').closest('[data-slot="table-cell"]')).toBeInTheDocument();
    expect(screen.getByText('Alice').closest('[data-slot="table-row"]')).toBeInTheDocument();
    expect(screen.getByText('Alice').closest('[data-slot="table-body"]')).toBeInTheDocument();
    expect(screen.getByText('Nome').closest('[data-slot="table-header"]')).toBeInTheDocument();
    expect(screen.getByText('Rodapé').closest('[data-slot="table-footer"]')).toBeInTheDocument();
  });
});

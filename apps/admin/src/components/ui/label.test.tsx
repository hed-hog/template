import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './label';

describe('Label', () => {
  it('renderiza o texto, o data-slot e associa via htmlFor', () => {
    render(
      <>
        <Label htmlFor="campo-nome">Nome</Label>
        <input id="campo-nome" />
      </>,
    );

    const label = screen.getByText('Nome');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('data-slot', 'label');
    expect(label.tagName).toBe('LABEL');
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('mescla className customizada com a classe padrão', () => {
    render(<Label className="custom-class">Rótulo</Label>);

    const label = screen.getByText('Rótulo');
    expect(label).toHaveClass('custom-class');
    expect(label).toHaveClass('flex');
  });
});

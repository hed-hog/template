import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Money } from './money';

describe('Money', () => {
  it('formata valor positivo em BRL', () => {
    render(<Money value={1234.5} />);

    expect(screen.getByText('R$ 1.234,50')).toHaveClass('tabular-nums');
  });

  it('mostra sinal positivo e classe verde quando showSign está ativo', () => {
    render(<Money value={10} showSign />);

    expect(screen.getByText('+R$ 10,00')).toHaveClass('text-green-600');
  });

  it('mostra negativo com sinal e classe vermelha', () => {
    render(<Money value={-10} showSign className="custom-class" />);

    expect(screen.getByText('-R$ 10,00')).toHaveClass(
      'text-red-600',
      'custom-class',
    );
  });
});

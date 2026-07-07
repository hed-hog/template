import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Spinner } from './spinner';

describe('Spinner', () => {
  it('renderiza com role status e label de acessibilidade', () => {
    render(<Spinner />);
    const el = screen.getByRole('status', { name: 'Loading' });
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-spin');
  });

  it('mescla className customizada', () => {
    render(<Spinner className="size-8" data-testid="spinner" />);
    const el = screen.getByTestId('spinner');
    expect(el).toHaveClass('size-8');
  });
});

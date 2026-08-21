import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renderiza com classes base e slot', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-pulse');
  });

  it('mescla className customizada e repassa props', () => {
    const { container } = render(<Skeleton className="h-4 w-full" data-testid="sk" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).toHaveClass('h-4');
    expect(el).toHaveAttribute('data-testid', 'sk');
  });
});

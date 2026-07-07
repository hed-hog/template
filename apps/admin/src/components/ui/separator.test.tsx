import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Separator } from './separator';

describe('Separator', () => {
  it('renderiza horizontal e decorativo por padrão', () => {
    const { container } = render(<Separator />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-orientation', 'horizontal');
    expect(el).toHaveAttribute('role', 'none');
  });

  it('renderiza na orientação vertical', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toHaveAttribute('data-orientation', 'vertical');
  });

  it('permite desabilitar o modo decorativo', () => {
    const { container } = render(<Separator decorative={false} />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toHaveAttribute('role', 'separator');
  });

  it('mescla className customizada', () => {
    const { container } = render(<Separator className="my-class" />);
    const el = container.querySelector('[data-slot="separator"]');
    expect(el).toHaveClass('my-class');
  });
});

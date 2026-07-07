import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { Slider } from './slider';

describe('Slider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      }))
    );
  });

  it('renderiza thumbs para min e max quando não há value/defaultValue', () => {
    const { container } = render(<Slider />);
    expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="slider-track"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="slider-range"]')).toBeInTheDocument();
  });

  it('renderiza um thumb por valor quando value é um array (range controlado)', () => {
    const { container } = render(<Slider value={[10, 40, 70]} />);
    expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(3);
  });

  it('renderiza um thumb por valor quando defaultValue é um array (não controlado)', () => {
    const { container } = render(<Slider defaultValue={[20, 80]} />);
    expect(container.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(2);
  });

  it('mescla className customizada e aceita min/max customizados', () => {
    const { container } = render(<Slider className="my-slider" min={5} max={15} />);
    expect(container.querySelector('[data-slot="slider"]')).toHaveClass('my-slider');
  });
});

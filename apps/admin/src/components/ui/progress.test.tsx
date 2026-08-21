import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Progress } from './progress';

function getIndicator(container: HTMLElement) {
  return container.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
}

describe('Progress', () => {
  it('renderiza com value definido, aplicando a translação correspondente', () => {
    const { container } = render(<Progress value={40} data-testid="progress" />);

    expect(screen.getByTestId('progress')).toBeInTheDocument();
    expect(getIndicator(container)).toHaveStyle({ transform: 'translateX(-60%)' });
  });

  it('renderiza com value 0', () => {
    const { container } = render(<Progress value={0} />);

    expect(getIndicator(container)).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('renderiza com value 100', () => {
    const { container } = render(<Progress value={100} />);

    expect(getIndicator(container)).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('renderiza sem value (undefined), tratando como 0', () => {
    const { container } = render(<Progress />);

    expect(getIndicator(container)).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('aceita className adicional', () => {
    const { container } = render(<Progress value={50} className="custom-class" />);

    expect(container.querySelector('[data-slot="progress"]')).toHaveClass('custom-class');
  });
});

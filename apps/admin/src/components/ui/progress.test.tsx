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

  it('expõe o valor a leitor de tela, e não só no transform', () => {
    // O shadcn não repassa `value` ao Root do Radix: a barra pintava certo e o
    // `role="progressbar"` ficava indeterminate, sem valor nenhum para anunciar.
    render(<Progress value={40} />);

    const barra = screen.getByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '40');
    expect(barra).toHaveAttribute('aria-valuemax', '100');
    expect(barra).toHaveAttribute('data-state', 'loading');
  });

  it('sem value continua indeterminado, sem anunciar um valor falso', () => {
    render(<Progress />);

    const barra = screen.getByRole('progressbar');
    expect(barra).not.toHaveAttribute('aria-valuenow');
    expect(barra).toHaveAttribute('data-state', 'indeterminate');
  });

  it('value igual ao máximo marca conclusão', () => {
    render(<Progress value={100} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'complete');
  });
});

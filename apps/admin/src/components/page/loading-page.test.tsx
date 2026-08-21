import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingPage } from './loading-page';

describe('LoadingPage', () => {
  it('renderiza o indicador de carregamento em tela cheia', () => {
    const { container } = render(<LoadingPage />);

    expect(container.querySelector('.loader')).toBeInTheDocument();
  });

  it('renderiza um único wrapper ocupando toda a tela', () => {
    const { container } = render(<LoadingPage />);
    const wrapper = container.firstElementChild;

    expect(wrapper).toHaveClass(
      'flex',
      'h-screen',
      'w-screen',
      'items-center',
      'justify-center',
      'bg-gray-100'
    );
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AspectRatio } from './aspect-ratio';

describe('AspectRatio', () => {
  it('renderiza o conteúdo filho com o atributo data-slot', () => {
    render(
      <AspectRatio ratio={16 / 9}>
        <span>conteúdo</span>
      </AspectRatio>,
    );
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    const wrapper = document.querySelector('[data-slot="aspect-ratio"]');
    expect(wrapper).toBeInTheDocument();
  });
});

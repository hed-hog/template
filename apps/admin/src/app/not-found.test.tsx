import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import NotFound from './not-found';

describe('NotFound', () => {
  it('renderiza a página 404 com o texto esperado', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
    expect(screen.getByText('Voltar para o início')).toBeInTheDocument();
  });
});

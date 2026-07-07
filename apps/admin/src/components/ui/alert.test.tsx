import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert', () => {
  it('renderiza a variante default', () => {
    render(
      <Alert>
        <AlertTitle>Título</AlertTitle>
        <AlertDescription>Descrição</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
  });

  it('renderiza a variante destructive', () => {
    render(<Alert variant="destructive">Erro</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('text-destructive');
  });

  it('aceita className customizado', () => {
    render(<Alert className="custom-class">Conteúdo</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('custom-class');
  });
});

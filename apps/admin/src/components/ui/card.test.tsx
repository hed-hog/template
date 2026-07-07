import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

describe('Card', () => {
  it('renderiza todos os subcomponentes com data-slot e classes customizadas', () => {
    render(
      <Card className="custom-card" data-testid="card">
        <CardHeader className="custom-header" data-testid="card-header">
          <CardTitle className="custom-title">Título</CardTitle>
          <CardDescription className="custom-description">
            Descrição
          </CardDescription>
          <CardAction className="custom-action" data-testid="card-action">
            Ação
          </CardAction>
        </CardHeader>
        <CardContent className="custom-content" data-testid="card-content">
          Conteúdo
        </CardContent>
        <CardFooter className="custom-footer" data-testid="card-footer">
          Rodapé
        </CardFooter>
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('data-slot', 'card');
    expect(card).toHaveClass('custom-card');

    const header = screen.getByTestId('card-header');
    expect(header).toHaveAttribute('data-slot', 'card-header');
    expect(header).toHaveClass('custom-header');

    const action = screen.getByTestId('card-action');
    expect(action).toHaveAttribute('data-slot', 'card-action');
    expect(action).toHaveClass('custom-action');

    const content = screen.getByTestId('card-content');
    expect(content).toHaveAttribute('data-slot', 'card-content');
    expect(content).toHaveClass('custom-content');

    const footer = screen.getByTestId('card-footer');
    expect(footer).toHaveAttribute('data-slot', 'card-footer');
    expect(footer).toHaveClass('custom-footer');

    expect(screen.getByText('Título')).toHaveAttribute(
      'data-slot',
      'card-title',
    );
    expect(screen.getByText('Descrição')).toHaveAttribute(
      'data-slot',
      'card-description',
    );
  });

  it('renderiza sem className customizada usando apenas os estilos padrão', () => {
    render(<Card data-testid="plain-card">Conteúdo</Card>);

    const card = screen.getByTestId('plain-card');
    expect(card).toHaveAttribute('data-slot', 'card');
    expect(card.className).toContain('bg-card');
  });
});

import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './hover-card';

describe('HoverCard', () => {
  it('abre o conteúdo ao focar/clicar no trigger e exibe as props padrão', async () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Abrir</HoverCardTrigger>
        <HoverCardContent>Conteúdo do card</HoverCardContent>
      </HoverCard>
    );

    fireEvent.click(screen.getByText('Abrir'));

    const content = await screen.findByText('Conteúdo do card');
    expect(content).toBeInTheDocument();
    expect(content).toHaveAttribute('data-slot', 'hover-card-content');
    expect(content).toHaveAttribute('data-align', 'center');
  });

  it('aceita align e sideOffset customizados e className extra', async () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent align="start" sideOffset={10} className="custom-class">
          Outro conteúdo
        </HoverCardContent>
      </HoverCard>
    );

    const content = await screen.findByText('Outro conteúdo');
    expect(content).toHaveAttribute('data-align', 'start');
    expect(content).toHaveClass('custom-class');
  });
});

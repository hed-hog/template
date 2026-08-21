import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('Tooltip', () => {
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

  it('renderiza o trigger e o conteúdo (aberto por padrão) com a seta visível', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Abrir</TooltipTrigger>
          <TooltipContent>Texto da dica</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(screen.getByText('Abrir')).toHaveAttribute('data-slot', 'tooltip-trigger');
    const content = document.querySelector('[data-slot="tooltip-content"]');
    expect(content).toHaveTextContent('Texto da dica');
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('oculta a seta quando hideArrow é true', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Abrir</TooltipTrigger>
          <TooltipContent hideArrow>Sem seta</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveTextContent(
      'Sem seta'
    );
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('usa delayDuration 0 por padrão no provider e aceita customização', () => {
    render(
      <TooltipProvider delayDuration={200}>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent className="extra-class">Conteúdo</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveClass('extra-class');
  });
});

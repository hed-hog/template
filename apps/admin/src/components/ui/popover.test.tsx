import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';

describe('Popover', () => {
  it('abre o conteúdo ao clicar no gatilho, usando align/sideOffset padrão', async () => {
    render(
      <Popover>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>Conteúdo do popover</PopoverContent>
      </Popover>,
    );

    expect(screen.queryByText('Conteúdo do popover')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Abrir'));

    expect(await screen.findByText('Conteúdo do popover')).toBeInTheDocument();
  });

  it('aceita align e sideOffset customizados', async () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent align="start" sideOffset={10} className="custom-class">
          Conteúdo customizado
        </PopoverContent>
      </Popover>,
    );

    const content = await screen.findByText('Conteúdo customizado');
    expect(content.closest('[data-slot="popover-content"]')).toHaveClass('custom-class');
  });

  it('renderiza o PopoverAnchor sem erros', () => {
    render(
      <Popover>
        <PopoverAnchor>
          <span>Âncora</span>
        </PopoverAnchor>
        <PopoverTrigger>Abrir</PopoverTrigger>
        <PopoverContent>Conteúdo</PopoverContent>
      </Popover>,
    );

    expect(screen.getByText('Âncora')).toBeInTheDocument();
  });
});

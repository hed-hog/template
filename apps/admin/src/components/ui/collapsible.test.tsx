import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';

describe('Collapsible', () => {
  it('renderiza fechado por padrão e abre ao clicar no gatilho', async () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Alternar</CollapsibleTrigger>
        <CollapsibleContent>Conteúdo oculto</CollapsibleContent>
      </Collapsible>,
    );

    fireEvent.click(screen.getByText('Alternar'));
    expect(await screen.findByText('Conteúdo oculto')).toBeInTheDocument();
  });

  it('suporta estado aberto controlado via defaultOpen', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Alternar</CollapsibleTrigger>
        <CollapsibleContent>Conteúdo visível</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByText('Conteúdo visível')).toBeInTheDocument();
  });
});

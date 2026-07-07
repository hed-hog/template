import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

function setup() {
  render(
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Pergunta 1</AccordionTrigger>
        <AccordionContent>Resposta 1</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Pergunta 2</AccordionTrigger>
        <AccordionContent>Resposta 2</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

describe('Accordion', () => {
  it('renderiza os gatilhos e mantém o conteúdo fechado inicialmente', () => {
    setup();
    expect(screen.getByText('Pergunta 1')).toBeInTheDocument();
    expect(screen.getByText('Pergunta 2')).toBeInTheDocument();
  });

  it('abre o conteúdo ao clicar no gatilho', async () => {
    setup();
    fireEvent.click(screen.getByText('Pergunta 1'));
    expect(await screen.findByText('Resposta 1')).toBeInTheDocument();
  });

  it('fecha o conteúdo ao clicar novamente (comportamento collapsible)', async () => {
    setup();
    const trigger = screen.getByText('Pergunta 1');
    fireEvent.click(trigger);
    expect(await screen.findByText('Resposta 1')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger.closest('[data-slot="accordion-trigger"]')).toHaveAttribute(
      'data-state',
      'closed',
    );
  });
});

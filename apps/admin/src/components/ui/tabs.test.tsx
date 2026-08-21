import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function setup() {
  render(
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Aba 1</TabsTrigger>
        <TabsTrigger value="tab2">Aba 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Conteúdo 1</TabsContent>
      <TabsContent value="tab2">Conteúdo 2</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('renderiza a lista, os triggers e mostra apenas o conteúdo da aba ativa', () => {
    setup();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Aba 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Aba 2' })).toBeInTheDocument();

    expect(screen.getByText('Conteúdo 1')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo 2')).not.toBeInTheDocument();
  });

  it('troca de aba ao clicar no trigger', () => {
    setup();

    const tab2 = screen.getByRole('tab', { name: 'Aba 2' });
    fireEvent.mouseDown(tab2);
    fireEvent.focus(tab2);
    fireEvent.click(tab2);

    expect(screen.getByText('Conteúdo 2')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo 1')).not.toBeInTheDocument();
  });

  it('aplica className customizada nos subcomponentes', () => {
    render(
      <Tabs defaultValue="a" className="custom-tabs">
        <TabsList className="custom-list">
          <TabsTrigger value="a" className="custom-trigger">
            A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="custom-content">
          Conteúdo A
        </TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole('tablist')).toHaveClass('custom-list');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveClass('custom-trigger');
    expect(screen.getByText('Conteúdo A')).toHaveClass('custom-content');
  });
});

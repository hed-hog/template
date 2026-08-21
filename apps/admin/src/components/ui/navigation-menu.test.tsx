import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuViewport,
} from './navigation-menu';

function setup(viewport?: boolean) {
  render(
    <NavigationMenu viewport={viewport}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Menu</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#link">Link 1</NavigationMenuLink>
          </NavigationMenuContent>
          <NavigationMenuIndicator />
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>,
  );
}

describe('NavigationMenu', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      })),
    );
  });

  it('renderiza o gatilho e mantém o conteúdo fechado inicialmente', () => {
    setup();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.queryByText('Link 1')).not.toBeInTheDocument();
  });

  it('abre o conteúdo e mostra o link ao clicar no gatilho (viewport padrão true)', async () => {
    setup();
    fireEvent.click(screen.getByText('Menu'));
    expect(await screen.findByText('Link 1')).toBeInTheDocument();
  });

  it('aplica data-viewport=false no root e omite o viewport quando viewport={false}', () => {
    render(
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="#">Item</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );

    expect(document.querySelector('[data-slot="navigation-menu"]')).toHaveAttribute(
      'data-viewport',
      'false',
    );
    expect(
      document.querySelector('[data-slot="navigation-menu-viewport"]'),
    ).not.toBeInTheDocument();
  });

  it('renderiza o NavigationMenuViewport com className customizado quando aberto', async () => {
    render(
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Menu</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="#">Item</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuViewport className="custom-viewport" />
      </NavigationMenu>,
    );

    fireEvent.click(screen.getByText('Menu'));
    await screen.findByText('Item');

    const viewport = document.querySelector('[data-slot="navigation-menu-viewport"]');
    expect(viewport).toBeInTheDocument();
    expect(viewport).toHaveClass('custom-viewport');
  });

  it('expõe a classe utilitária navigationMenuTriggerStyle', () => {
    expect(navigationMenuTriggerStyle()).toContain('inline-flex');
  });
});

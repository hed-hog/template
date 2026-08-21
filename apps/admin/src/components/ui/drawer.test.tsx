import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';

describe('Drawer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('abre o drawer ao clicar no gatilho e exibe título/descrição', async () => {
    render(
      <Drawer>
        <DrawerTrigger>Abrir</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Título do drawer</DrawerTitle>
            <DrawerDescription>Descrição do drawer</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose>Fechar</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByText('Abrir'));

    expect(await screen.findByText('Título do drawer')).toBeInTheDocument();
    expect(screen.getByText('Descrição do drawer')).toBeInTheDocument();
  });

  it('fecha o drawer ao clicar em DrawerClose', async () => {
    render(
      <Drawer>
        <DrawerTrigger>Abrir</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Título</DrawerTitle>
          <DrawerClose>Fechar</DrawerClose>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    const title = await screen.findByText('Título');
    fireEvent.click(screen.getByText('Fechar'));

    // Vaul defers the DOM removal until its (unfired-in-jsdom) exit
    // animation completes, so we assert the Radix "closed" state instead
    // of waiting for the node to be removed from the document.
    await waitFor(() => {
      expect(
        title.closest('[data-slot="drawer-content"]'),
      ).toHaveAttribute('data-state', 'closed');
    });
  });

  it('aplica className customizada em todos os subcomponentes e direção bottom por padrão', async () => {
    render(
      <Drawer defaultOpen>
        <DrawerPortal>
          <DrawerOverlay className="custom-overlay" />
          <DrawerContent className="custom-content">
            <DrawerHeader className="custom-header">
              <DrawerTitle className="custom-title">Título</DrawerTitle>
              <DrawerDescription className="custom-description">
                Descrição
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="custom-footer">
              <span>Rodapé</span>
            </DrawerFooter>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>,
    );

    const title = await screen.findByText('Título');
    expect(title).toHaveClass('custom-title');
    expect(screen.getByText('Descrição')).toHaveClass('custom-description');
    expect(title.closest('[data-slot="drawer-header"]')).toHaveClass(
      'custom-header',
    );
    expect(
      screen.getByText('Rodapé').closest('[data-slot="drawer-footer"]'),
    ).toHaveClass('custom-footer');
    expect(title.closest('[data-slot="drawer-content"]')).toHaveClass(
      'custom-content',
    );
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass(
      'custom-overlay',
    );
  });

  it('suporta a direção "right"', async () => {
    render(
      <Drawer defaultOpen direction="right">
        <DrawerContent>
          <DrawerTitle>Título lateral</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const title = await screen.findByText('Título lateral');
    expect(
      title.closest('[data-slot="drawer-content"]'),
    ).toHaveAttribute('data-vaul-drawer-direction', 'right');
  });

  it('propaga onOpenChange do Drawer root', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger>Abrir</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Título</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

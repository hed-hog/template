import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

describe('Sheet', () => {
  it('abre via SheetTrigger e exibe o conteúdo', () => {
    render(
      <Sheet>
        <SheetTrigger>Abrir</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Título</SheetTitle>
            <SheetDescription>Descrição</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Fechar rodapé</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByText('Título')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Abrir'));

    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
  });

  it('fecha ao clicar no botão de fechar (X) do conteúdo', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Conteúdo</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByText('Conteúdo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close'));

    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza o overlay com as classes esperadas quando aberto', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Overlay content</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByText('Overlay content')).toBeInTheDocument();

    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.className).toContain('fixed inset-0 z-50 bg-black/50');
  });

  it('fecha via SheetClose customizado', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Fechável</SheetTitle>
          <SheetClose>Fechar</SheetClose>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByText('Fechar'));

    expect(screen.queryByText('Fechável')).not.toBeInTheDocument();
  });

  it('funciona no modo controlado via open/onOpenChange', () => {
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = React.useState(false);
      return (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <SheetTrigger>Trigger controlado</SheetTrigger>
          <SheetContent>
            <SheetTitle>Controlado</SheetTitle>
          </SheetContent>
        </Sheet>
      );
    }

    render(<Controlled />);

    expect(screen.queryByText('Controlado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Trigger controlado'));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Controlado')).toBeInTheDocument();
  });

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'renderiza a variante side="%s" com as classes esperadas',
    (side) => {
      render(
        <Sheet defaultOpen>
          <SheetContent side={side}>
            <SheetTitle>{`Conteúdo ${side}`}</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      const content = document.querySelector('[data-slot="sheet-content"]');
      expect(content).toBeTruthy();
      expect(content?.className).toContain(
        side === 'right'
          ? 'inset-y-0 right-0'
          : side === 'left'
            ? 'inset-y-0 left-0'
            : side === 'top'
              ? 'inset-x-0 top-0'
              : 'inset-x-0 bottom-0',
      );
    },
  );

  it('renderiza SheetContent com side padrão (right) quando não informado', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Padrão</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const content = document.querySelector('[data-slot="sheet-content"]');
    expect(content?.className).toContain('inset-y-0 right-0');
  });

  it('aceita className customizado em SheetHeader e SheetFooter', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Custom</SheetTitle>
          <SheetHeader className="custom-header">Header</SheetHeader>
          <SheetFooter className="custom-footer">Footer</SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    expect(document.querySelector('.custom-header')).toBeInTheDocument();
    expect(document.querySelector('.custom-footer')).toBeInTheDocument();
  });
});

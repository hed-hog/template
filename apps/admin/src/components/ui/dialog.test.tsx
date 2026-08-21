import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog';

describe('Dialog', () => {
  it('abre o diálogo ao clicar no gatilho e exibe título/descrição', async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Título do diálogo</DialogTitle>
            <DialogDescription>Descrição do diálogo</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Fechar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText('Abrir'));

    expect(await screen.findByText('Título do diálogo')).toBeInTheDocument();
    expect(screen.getByText('Descrição do diálogo')).toBeInTheDocument();
  });

  it('exibe o botão de fechar por padrão e fecha o diálogo ao clicar nele', async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    await screen.findByText('Título');

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);

    expect(screen.queryByText('Título')).not.toBeInTheDocument();
  });

  it('oculta o botão de fechar quando showCloseButton é false', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Sem botão de fechar</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await screen.findByText('Sem botão de fechar');
    expect(
      screen.queryByRole('button', { name: 'Close' }),
    ).not.toBeInTheDocument();
  });

  it('fecha o diálogo através de um DialogClose customizado (asChild)', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Confirmar</DialogTitle>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button">Cancelar</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await screen.findByText('Confirmar');
    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.queryByText('Confirmar')).not.toBeInTheDocument();
  });

  it('aplica className customizada aos subcomponentes', async () => {
    render(
      <Dialog defaultOpen>
        <DialogPortal>
          <DialogOverlay className="custom-overlay" />
          <DialogContent className="custom-content">
            <DialogHeader className="custom-header">
              <DialogTitle className="custom-title">Título</DialogTitle>
              <DialogDescription className="custom-description">
                Descrição
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="custom-footer">
              <span>Rodapé</span>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    );

    const title = await screen.findByText('Título');
    expect(title).toHaveClass('custom-title');
    expect(screen.getByText('Descrição')).toHaveClass('custom-description');
    expect(title.closest('[data-slot="dialog-header"]')).toHaveClass(
      'custom-header',
    );
    expect(screen.getByText('Rodapé').closest('[data-slot="dialog-footer"]')).toHaveClass(
      'custom-footer',
    );
    expect(
      title.closest('[data-slot="dialog-content"]'),
    ).toHaveClass('custom-content');
    expect(
      document.querySelector('[data-slot="dialog-overlay"]'),
    ).toHaveClass('custom-overlay');
  });

  it('não fecha ao interagir com props adicionais e propaga onOpenChange', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText('Abrir'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

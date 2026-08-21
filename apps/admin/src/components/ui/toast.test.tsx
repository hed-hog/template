import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

describe('Toast', () => {
  it('renderiza título, descrição, ação e botão de fechar com variante padrão', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Título padrão</ToastTitle>
          <ToastDescription>Descrição padrão</ToastDescription>
          <ToastAction altText="Refazer">Refazer</ToastAction>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(screen.getByText('Título padrão')).toBeInTheDocument();
    expect(screen.getByText('Descrição padrão')).toBeInTheDocument();
    expect(screen.getByText('Refazer')).toBeInTheDocument();

    const toastEl = screen.getByText('Título padrão').closest('[role="status"]');
    expect(toastEl?.className).toContain('bg-background');
  });

  it('aplica classes da variante destructive', () => {
    render(
      <ToastProvider>
        <Toast open variant="destructive">
          <ToastTitle>Erro</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const toastEl = screen.getByText('Erro').closest('[role="status"]');
    expect(toastEl?.className).toContain('destructive');
    expect(toastEl?.className).toContain('border-destructive');
  });

  it('fecha ao clicar no botão de fechar (ToastClose)', () => {
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = React.useState(true);
      return (
        <ToastProvider>
          <Toast
            open={open}
            onOpenChange={(next) => {
              onOpenChange(next);
              setOpen(next);
            }}
          >
            <ToastTitle>Fechável</ToastTitle>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );
    }

    render(<Controlled />);

    expect(screen.getByText('Fechável')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('aceita className customizado no ToastAction e ToastClose', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Custom</ToastTitle>
          <ToastAction altText="Ação" className="custom-action">
            Ação
          </ToastAction>
          <ToastClose className="custom-close" />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(document.querySelector('.custom-action')).toBeInTheDocument();
    expect(document.querySelector('.custom-close')).toBeInTheDocument();
  });

  it('renderiza o ToastViewport com className customizado', () => {
    render(
      <ToastProvider>
        <ToastViewport className="custom-viewport" />
      </ToastProvider>,
    );

    expect(document.querySelector('.custom-viewport')).toBeInTheDocument();
  });
});

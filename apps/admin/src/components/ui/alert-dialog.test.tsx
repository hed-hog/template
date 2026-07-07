import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';

function setup(onAction = vi.fn(), onCancel = vi.fn()) {
  render(
    <AlertDialog>
      <AlertDialogTrigger>Abrir</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe('AlertDialog', () => {
  it('abre o diálogo ao clicar no gatilho e exibe título/descrição', async () => {
    setup();
    fireEvent.click(screen.getByText('Abrir'));
    expect(await screen.findByText('Tem certeza?')).toBeInTheDocument();
    expect(
      screen.getByText('Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument();
  });

  it('aciona o callback de confirmação', async () => {
    const onAction = vi.fn();
    setup(onAction);
    fireEvent.click(screen.getByText('Abrir'));
    fireEvent.click(await screen.findByText('Confirmar'));
    expect(onAction).toHaveBeenCalled();
  });

  it('aciona o callback de cancelamento e fecha o diálogo', async () => {
    const onCancel = vi.fn();
    setup(undefined, onCancel);
    fireEvent.click(screen.getByText('Abrir'));
    fireEvent.click(await screen.findByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
  });
});

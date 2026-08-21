import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const useToastMock = vi.fn();

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => useToastMock(),
}));

import { Toaster } from './toaster';

describe('Toaster', () => {
  it('não renderiza nenhum toast quando a lista está vazia', () => {
    useToastMock.mockReturnValue({ toasts: [] });

    render(<Toaster />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renderiza um toast apenas com título', () => {
    useToastMock.mockReturnValue({
      toasts: [{ id: '1', title: 'Somente título' }],
    });

    render(<Toaster />);

    expect(screen.getByText('Somente título')).toBeInTheDocument();
  });

  it('renderiza um toast apenas com descrição', () => {
    useToastMock.mockReturnValue({
      toasts: [{ id: '2', description: 'Somente descrição' }],
    });

    render(<Toaster />);

    expect(screen.getByText('Somente descrição')).toBeInTheDocument();
  });

  it('renderiza um toast com título e descrição', () => {
    useToastMock.mockReturnValue({
      toasts: [
        { id: '3', title: 'Título completo', description: 'Descrição completa' },
      ],
    });

    render(<Toaster />);

    expect(screen.getByText('Título completo')).toBeInTheDocument();
    expect(screen.getByText('Descrição completa')).toBeInTheDocument();
  });

  it('renderiza um toast com ação', () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: '4',
          title: 'Com ação',
          action: <button type="button">Desfazer</button>,
        },
      ],
    });

    render(<Toaster />);

    expect(screen.getByText('Com ação')).toBeInTheDocument();
    expect(screen.getByText('Desfazer')).toBeInTheDocument();
  });

  it('renderiza um toast sem título nem descrição (apenas ação e fechar)', () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: '5',
          action: <button type="button">Ação isolada</button>,
        },
      ],
    });

    render(<Toaster />);

    expect(screen.getByText('Ação isolada')).toBeInTheDocument();
  });

  it('renderiza múltiplos toasts simultaneamente', () => {
    useToastMock.mockReturnValue({
      toasts: [
        { id: '6', title: 'Primeiro' },
        { id: '7', title: 'Segundo' },
      ],
    });

    render(<Toaster />);

    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });
});

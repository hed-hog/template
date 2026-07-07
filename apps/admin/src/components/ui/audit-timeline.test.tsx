import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AuditTimeline } from './audit-timeline';

describe('AuditTimeline', () => {
  it('renderiza eventos conhecidos com rótulo, data formatada e autor', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '1',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'u1',
            usuarioNome: 'Maria',
            acao: 'CREATE',
            detalhes: 'Registro criado',
          },
        ]}
      />,
    );

    expect(screen.getByText('Criação')).toBeInTheDocument();
    expect(screen.getByText('Registro criado')).toBeInTheDocument();
    expect(screen.getByText('por Maria')).toBeInTheDocument();
  });

  it('usa a própria ação como rótulo quando não mapeada', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '2',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'u1',
            acao: 'ACAO_DESCONHECIDA',
            detalhes: 'Algo aconteceu',
          },
        ]}
      />,
    );
    expect(screen.getByText('ACAO_DESCONHECIDA')).toBeInTheDocument();
  });

  it('usa "Sistema" quando não há usuarioNome nem usuarioId', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '3',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: '',
            acao: 'UPDATE',
            detalhes: 'Atualizado',
          },
        ]}
      />,
    );
    expect(screen.getByText('por Sistema')).toBeInTheDocument();
  });

  it('usa usuarioId quando usuarioNome não é fornecido', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '4',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'user-42',
            acao: 'DELETE',
            detalhes: 'Removido',
          },
        ]}
      />,
    );
    expect(screen.getByText('por user-42')).toBeInTheDocument();
  });

  it('exibe valores antes/depois quando ambos são fornecidos', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '5',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'u1',
            acao: 'UPDATE',
            detalhes: 'Alteração de status',
            antes: 'Pendente',
            depois: 'Aprovado',
          },
        ]}
      />,
    );
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('não exibe bloco antes/depois quando apenas um dos valores é fornecido', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '6',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'u1',
            acao: 'UPDATE',
            detalhes: 'Alteração parcial',
            antes: 'Pendente',
          },
        ]}
      />,
    );
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument();
  });

  it('exibe o valor bruto quando a data é inválida', () => {
    render(
      <AuditTimeline
        events={[
          {
            id: '7',
            data: 'data-invalida',
            usuarioId: 'u1',
            acao: 'CREATE',
            detalhes: 'Evento com data inválida',
          },
        ]}
      />,
    );
    expect(screen.getByText('data-invalida')).toBeInTheDocument();
  });

  it('renderiza o conector entre eventos, exceto após o último', () => {
    const { container } = render(
      <AuditTimeline
        events={[
          {
            id: '8',
            data: '2024-01-15T10:30:00.000Z',
            usuarioId: 'u1',
            acao: 'CREATE',
            detalhes: 'Primeiro',
          },
          {
            id: '9',
            data: '2024-01-16T10:30:00.000Z',
            usuarioId: 'u1',
            acao: 'UPDATE',
            detalhes: 'Segundo',
          },
        ]}
      />,
    );
    // 1 connector line expected (between event 1 and 2, none after the last)
    const connectors = container.querySelectorAll('.bg-border');
    expect(connectors).toHaveLength(1);
  });

  it('aceita className customizado', () => {
    const { container } = render(
      <AuditTimeline events={[]} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

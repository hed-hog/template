import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { EntityCard } from './entity-card';

describe('EntityCard', () => {
  it('renderiza título e descrição, sem avatar/badges/metadata/actions', () => {
    render(<EntityCard title="João" description="Descrição" />);
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
  });

  it('sem descrição, não renderiza o parágrafo de descrição', () => {
    const { container } = render(<EntityCard title="Sem descrição" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('renderiza avatar com src e fallback', () => {
    const { container } = render(
      <EntityCard
        title="Com Avatar"
        avatar={{ src: 'http://x.test/a.png', fallback: 'JR' }}
      />
    );
    expect(container.querySelector('.h-12.w-12')).toBeInTheDocument();
  });

  it('renderiza badges com variant explícita e com fallback "default"', () => {
    render(
      <EntityCard
        title="Badges"
        badges={[
          { label: 'Ativo', variant: 'secondary' },
          { label: 'Padrão' },
        ]}
      />
    );
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Padrão')).toBeInTheDocument();
  });

  it('não renderiza área de badges quando o array é vazio', () => {
    render(<EntityCard title="Sem badges" badges={[]} />);
    expect(screen.queryByText('Ativo')).not.toBeInTheDocument();
  });

  it('renderiza metadata com e sem ícone', () => {
    render(
      <EntityCard
        title="Metadata"
        metadata={[
          { label: 'Email', value: 'a@a.com', icon: <span>icon</span> },
          { label: 'Telefone', value: '123' },
        ]}
      />
    );
    expect(screen.getByText('Email:')).toBeInTheDocument();
    expect(screen.getByText('a@a.com')).toBeInTheDocument();
    expect(screen.getByText('Telefone:')).toBeInTheDocument();
  });

  it('não renderiza área de metadata quando o array é vazio', () => {
    const { container } = render(<EntityCard title="Sem metadata" metadata={[]} />);
    expect(container.querySelector('.space-y-1')).not.toBeInTheDocument();
  });

  it('renderiza actions com e sem ícone, e clique chama onClick sem propagar', () => {
    const onCardClick = vi.fn();
    const onActionClick = vi.fn();
    render(
      <EntityCard
        title="Actions"
        onClick={onCardClick}
        actions={[
          { label: 'Editar', onClick: onActionClick, icon: <span>icon</span> },
          { label: 'Excluir', onClick: vi.fn(), variant: 'destructive' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(onActionClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('não renderiza área de actions quando o array é vazio', () => {
    render(<EntityCard title="Sem actions" actions={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aplica cursor-pointer e chama onClick ao clicar no card quando onClick é informado', () => {
    const onClick = vi.fn();
    const { container } = render(<EntityCard title="Clicável" onClick={onClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('cursor-pointer');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sem onClick, não aplica cursor-pointer', () => {
    const { container } = render(<EntityCard title="Não clicável" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('cursor-pointer');
  });
});

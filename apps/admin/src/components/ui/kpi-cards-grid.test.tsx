import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./kpi-card', () => ({
  KpiCard: ({
    title,
    className,
    layout,
  }: {
    title: React.ReactNode;
    className?: string;
    layout?: string;
  }) => (
    <div data-testid="kpi-card" data-class={className} data-layout={layout}>
      {title}
    </div>
  ),
}));

import { KpiCardsGrid } from './kpi-cards-grid';
import type { KpiCardItem } from './kpi-card';

const items: KpiCardItem[] = [
  { key: 'total', title: 'Total', value: 10 },
  { key: 'active', title: 'Ativos', value: 5, className: 'item-specific' },
];

function makeItems(count: number): KpiCardItem[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `kpi-${index}`,
    title: `KPI ${index}`,
    value: index,
  }));
}

describe('KpiCardsGrid', () => {
  it('usa a grade "auto" por padrão e renderiza todos os itens', () => {
    const { container } = render(<KpiCardsGrid items={items} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Ativos')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('xl:grid-cols-4');
  });

  it.each([2, 3, 4, 5, 6, 7, 8] as const)(
    'aceita a quantidade de colunas customizada: %s',
    (columns) => {
      const { container } = render(
        <KpiCardsGrid items={items} columns={columns} />,
      );
      expect(container.firstChild).toHaveClass('grid');
    },
  );

  it('mescla className do wrapper e combina cardClassName com o className do item', () => {
    const { container } = render(
      <KpiCardsGrid items={items} className="wrapper-class" cardClassName="card-class" />,
    );

    expect(container.firstChild).toHaveClass('wrapper-class');

    const cards = screen.getAllByTestId('kpi-card');
    // first item has no itemClassName -> only cardClassName
    expect(cards[0]).toHaveAttribute('data-class', 'card-class');
    // second item merges cardClassName with its own itemClassName
    expect(cards[1]!.getAttribute('data-class')).toContain('card-class');
    expect(cards[1]!.getAttribute('data-class')).toContain('item-specific');
  });

  it.each([
    [3, 'xl:grid-cols-4', 'default'],
    [4, 'xl:grid-cols-4', 'default'],
    [5, 'xl:grid-cols-5', 'compact'],
    [6, 'xl:grid-cols-6', 'compact'],
    [7, 'xl:grid-cols-7', 'dense'],
    [8, 'xl:grid-cols-8', 'dense'],
  ] as const)(
    'com %s itens abre a grade em %s e aperta os cards para %s',
    (count, gridClass, layout) => {
      const { container } = render(<KpiCardsGrid items={makeItems(count)} />);

      expect(container.firstChild).toHaveClass(gridClass);
      for (const card of screen.getAllByTestId('kpi-card')) {
        expect(card).toHaveAttribute('data-layout', layout);
      }
    },
  );

  it('mantém a grade de 8 colunas quando há mais de 8 itens', () => {
    const { container } = render(<KpiCardsGrid items={makeItems(11)} />);
    expect(container.firstChild).toHaveClass('xl:grid-cols-8');
  });

  it('aplica a densidade também quando as colunas são explícitas', () => {
    render(<KpiCardsGrid items={items} columns={6} />);
    expect(screen.getAllByTestId('kpi-card')[0]).toHaveAttribute(
      'data-layout',
      'compact',
    );
  });

  it('respeita a densidade explícita do grid', () => {
    render(<KpiCardsGrid items={items} density="dense" />);
    expect(screen.getAllByTestId('kpi-card')[0]).toHaveAttribute(
      'data-layout',
      'dense',
    );
  });

  it('deixa o item apertar mais que a grade, mas nunca afrouxar', () => {
    render(
      <KpiCardsGrid
        items={[
          { key: 'a', title: 'A', value: 1, layout: 'dense' },
          { key: 'b', title: 'B', value: 2 },
        ]}
      />,
    );

    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[0]).toHaveAttribute('data-layout', 'dense');
    expect(cards[1]).toHaveAttribute('data-layout', 'default');
  });

  it('não afrouxa um item "compact" numa grade densa', () => {
    const denseItems = makeItems(8).map((item, index) =>
      index === 0 ? { ...item, layout: 'compact' as const } : item,
    );

    render(<KpiCardsGrid items={denseItems} />);
    expect(screen.getAllByTestId('kpi-card')[0]).toHaveAttribute(
      'data-layout',
      'dense',
    );
  });
});

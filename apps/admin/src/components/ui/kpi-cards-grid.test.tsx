import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./kpi-card', () => ({
  KpiCard: ({ title, className }: { title: React.ReactNode; className?: string }) => (
    <div data-testid="kpi-card" data-class={className}>
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

describe('KpiCardsGrid', () => {
  it('usa a grade "auto" por padrão e renderiza todos os itens', () => {
    const { container } = render(<KpiCardsGrid items={items} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Ativos')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('xl:grid-cols-4');
  });

  it.each([2, 3, 4, 5, 6] as const)(
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
    expect(cards[1].getAttribute('data-class')).toContain('card-class');
    expect(cards[1].getAttribute('data-class')).toContain('item-specific');
  });
});

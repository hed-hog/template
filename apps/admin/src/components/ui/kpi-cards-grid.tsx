import { cn } from '@/lib/utils';
import { KpiCard, type KpiCardItem } from './kpi-card';

type KpiCardsGridColumns = 'auto' | 2 | 3 | 4 | 5 | 6;

type KpiCardsGridProps = {
  items: KpiCardItem[];
  columns?: KpiCardsGridColumns;
  className?: string;
  cardClassName?: string;
};

const columnClassNames: Record<KpiCardsGridColumns, string> = {
  auto: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4',
  2: 'grid grid-cols-2 gap-3 md:grid-cols-2',
  3: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3',
  4: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4',
  5: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5',
  6: 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6',
};

export function KpiCardsGrid({
  items,
  columns = 'auto',
  className,
  cardClassName,
}: KpiCardsGridProps) {
  return (
    <div className={cn(columnClassNames[columns], className)}>
      {items.map(({ key, className: itemClassName, ...item }) => (
        <KpiCard
          key={key}
          {...item}
          className={cn(cardClassName, itemClassName)}
        />
      ))}
    </div>
  );
}

export type { KpiCardItem } from './kpi-card';

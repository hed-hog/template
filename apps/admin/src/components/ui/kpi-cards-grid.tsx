import { cn } from '@/lib/utils';
import { KpiCard, type KpiCardItem, type KpiCardLayout } from './kpi-card';

type KpiCardsGridColumns = 'auto' | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type ResolvedColumns = Exclude<KpiCardsGridColumns, 'auto'>;

type KpiCardsGridProps = {
  items: KpiCardItem[];
  columns?: KpiCardsGridColumns;
  /**
   * Densidade dos cards. Em `auto` ela sai do número de colunas resolvido:
   * quanto mais KPIs dividem a linha, menor o card. Um item que pede densidade
   * mais apertada continua valendo — a grade aperta, nunca afrouxa.
   */
  density?: 'auto' | KpiCardLayout;
  className?: string;
  cardClassName?: string;
};

// Strings completas de propósito: o Tailwind só gera a classe que encontra
// literal no fonte, então nada de montar `xl:grid-cols-${n}` em runtime.
const columnClassNames: Record<ResolvedColumns, string> = {
  2: 'grid grid-cols-2 gap-3 md:grid-cols-2',
  3: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3',
  4: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4',
  5: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5',
  6: 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6',
  7: 'grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7',
  8: 'grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8',
};

const densityByColumns: Record<ResolvedColumns, KpiCardLayout> = {
  2: 'default',
  3: 'default',
  4: 'default',
  5: 'compact',
  6: 'compact',
  7: 'dense',
  8: 'dense',
};

const layoutWeight: Record<KpiCardLayout, number> = {
  default: 0,
  compact: 1,
  dense: 2,
};

/**
 * Até 4 KPIs a grade é a de sempre — inclusive o vão à direita quando são 3.
 * A partir de 5 ela abre uma coluna por KPI para tudo caber numa linha só, com
 * teto de 8: abaixo dessa largura o card deixa de ser legível e é melhor
 * quebrar a linha do que espremer.
 */
function resolveColumns(
  columns: KpiCardsGridColumns,
  itemCount: number
): ResolvedColumns {
  if (columns !== 'auto') {
    return columns;
  }

  return itemCount <= 4 ? 4 : (Math.min(itemCount, 8) as ResolvedColumns);
}

function denserLayout(a: KpiCardLayout, b: KpiCardLayout): KpiCardLayout {
  return layoutWeight[a] >= layoutWeight[b] ? a : b;
}

export function KpiCardsGrid({
  items,
  columns = 'auto',
  density = 'auto',
  className,
  cardClassName,
}: KpiCardsGridProps) {
  const resolvedColumns = resolveColumns(columns, items.length);
  const gridLayout =
    density === 'auto' ? densityByColumns[resolvedColumns] : density;

  return (
    <div className={cn(columnClassNames[resolvedColumns], className)}>
      {items.map(({ key, className: itemClassName, layout, ...item }) => (
        <KpiCard
          key={key}
          {...item}
          layout={denserLayout(layout ?? 'default', gridLayout)}
          className={cn(cardClassName, itemClassName)}
        />
      ))}
    </div>
  );
}

export type { KpiCardItem } from './kpi-card';

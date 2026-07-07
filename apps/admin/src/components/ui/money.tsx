import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarMoeda(value: number) {
  return currencyFormatter.format(value);
}

interface MoneyProps {
  value: number;
  className?: string;
  showSign?: boolean;
}

export function Money({ value, className, showSign = false }: MoneyProps) {
  const isNegative = value < 0;
  const formatted = formatarMoeda(Math.abs(value));

  return (
    <span
      className={cn(
        'tabular-nums',
        isNegative && 'text-red-600',
        !isNegative && showSign && 'text-green-600',
        className
      )}
    >
      {showSign && !isNegative && '+'}
      {isNegative && '-'}
      {formatted}
    </span>
  );
}

import { cn } from '@/lib/utils';

const DEFAULT_CURRENCY = 'BRL';
const formatters = new Map<string, Intl.NumberFormat | null>();

function getFormatter(currency: string) {
  if (!formatters.has(currency)) {
    try {
      formatters.set(
        currency,
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency })
      );
    } catch {
      // Codigo fora do ISO 4217 (moeda cadastrada a mao): cai no numero puro
      // com o codigo na frente em vez de derrubar a tela.
      formatters.set(currency, null);
    }
  }

  return formatters.get(currency) ?? null;
}

/**
 * Formata um valor na moeda informada (padrao BRL). Nunca converte: o valor ja
 * tem que estar na moeda que se pede para mostrar.
 */
export function formatMoney(value: number, currency: string = DEFAULT_CURRENCY) {
  const code = (currency || DEFAULT_CURRENCY).trim().toUpperCase();
  const formatter = getFormatter(code);

  if (formatter) {
    return formatter.format(value);
  }

  return `${code} ${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

interface MoneyProps {
  value: number;
  className?: string;
  showSign?: boolean;
  /** Codigo ISO 4217 da moeda do valor. Padrao: BRL. */
  currency?: string;
}

export function Money({
  value,
  className,
  showSign = false,
  currency = DEFAULT_CURRENCY,
}: MoneyProps) {
  const isNegative = value < 0;
  const formatted = formatMoney(Math.abs(value), currency);

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

'use client';

import { cn } from '@/lib/utils';

/**
 * Anel de progresso com o percentual no centro.
 *
 * Existe para o caso em que uma barra horizontal custa caro: numa lista densa
 * ela precisa de largura para ser legível, e essa largura sai do texto ao lado.
 * O anel diz a mesma coisa num quadrado do tamanho de uma linha de texto.
 */
export function ProgressDonut({
  value,
  size = 26,
  thickness = 3,
  className,
  trackClassName = 'text-muted/60',
  indicatorClassName = 'text-emerald-500',
  label,
}: {
  /** 0–100. Valores fora da faixa são cortados. */
  value: number;
  size?: number;
  thickness?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  /** Texto do centro. O padrão é o próprio percentual, sem o sinal. */
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // `strokeDasharray` desenha o arco; o `-90°` põe o zero no topo, e não às 3h.
  const filled = (percent / 100) * circumference;

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={cn('stroke-current', trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className={cn('stroke-current transition-[stroke-dasharray] duration-700', indicatorClassName)}
        />
      </svg>
      <span
        className="absolute font-medium tabular-nums"
        style={{ fontSize: Math.max(8, Math.round(size * 0.32)) }}
      >
        {label ?? percent}
      </span>
    </span>
  );
}

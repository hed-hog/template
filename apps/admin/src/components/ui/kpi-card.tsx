'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type KpiCardLayout = 'compact' | 'default';

export interface KpiCardProps {
  title: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Custom media rendered in place of the icon (e.g. an avatar/logo). Takes precedence over `icon`. */
  media?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  accentClassName?: string;
  iconContainerClassName?: string;
  className?: string;
  contentClassName?: string;
  valueClassName?: string;
  descriptionClassName?: string;
  loading?: boolean;
  layout?: KpiCardLayout;
}

export type KpiCardItem = KpiCardProps & {
  key: string;
};

const fallbackKpiAccentClassName =
  'from-sky-500/20 via-cyan-500/10 to-transparent';
const fallbackKpiIconContainerClassName = 'bg-sky-500/10 text-sky-700';

function AnimatedValueStyles() {
  return (
    <style jsx global>{`
      @keyframes kpi-delta-float {
        0% {
          opacity: 0;
          transform: translate3d(0, 4px, 0) scale(0.96);
          filter: blur(0.8px);
        }

        20% {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
          filter: blur(0);
        }

        64% {
          opacity: 1;
          transform: translate3d(0, calc(var(--delta-lift-y) * -0.28), 0)
            scale(1);
          filter: blur(0);
        }

        100% {
          opacity: 0;
          transform: translate3d(0, calc(var(--delta-lift-y) * -1), 0)
            scale(0.98);
          filter: blur(1.2px);
        }
      }
    `}</style>
  );
}

function AnimatedValue({
  value,
  duration = 900,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [floatingDelta, setFloatingDelta] = useState<{
    id: number;
    value: number;
    liftY: number;
  } | null>(null);
  const displayValueRef = useRef(value);
  const deltaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatingDeltaIdRef = useRef(0);

  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    const startValue = displayValueRef.current;

    if (startValue === value) {
      return;
    }

    const valueDelta = value - startValue;

    floatingDeltaIdRef.current += 1;
    setFloatingDelta({
      id: floatingDeltaIdRef.current,
      value: valueDelta,
      liftY: Math.round((Math.random() * 8 + 18) * 10) / 10,
    });

    if (deltaTimeoutRef.current) {
      clearTimeout(deltaTimeoutRef.current);
    }

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(
        startValue + (value - startValue) * easedProgress
      );

      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    deltaTimeoutRef.current = setTimeout(() => {
      setFloatingDelta(null);
    }, 1700);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (deltaTimeoutRef.current) {
        clearTimeout(deltaTimeoutRef.current);
      }
    };
  }, [duration, value]);

  const floatingDeltaStyle = floatingDelta
    ? ({
        '--delta-lift-y': `${floatingDelta.liftY}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <AnimatedValueStyles />
      <span className="relative inline-flex items-center overflow-visible">
        <span>{new Intl.NumberFormat('pt-BR').format(displayValue)}</span>
        {floatingDelta ? (
          <span
            key={floatingDelta.id}
            className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 select-none"
            style={floatingDeltaStyle}
            aria-hidden="true"
          >
            <span
              className={cn(
                'inline-flex will-change-transform whitespace-nowrap',
                'animate-[kpi-delta-float_1600ms_cubic-bezier(0.16,1,0.3,1)_forwards]',
                floatingDelta.value >= 0
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-300'
              )}
            >
              <span className="relative">
                <span
                  className={cn(
                    'absolute inset-0 blur-xs opacity-35',
                    floatingDelta.value >= 0
                      ? 'text-emerald-400 dark:text-emerald-200'
                      : 'text-rose-400 dark:text-rose-200'
                  )}
                >
                  {floatingDelta.value > 0 ? '+' : ''}
                  {new Intl.NumberFormat('pt-BR').format(floatingDelta.value)}
                </span>
                <span
                  className={cn(
                    'relative inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em]',
                    'backdrop-blur-[2px] shadow-[0_8px_20px_-14px_currentColor]',
                    floatingDelta.value >= 0
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200'
                      : 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-200'
                  )}
                >
                  {floatingDelta.value > 0 ? '+' : ''}
                  {new Intl.NumberFormat('pt-BR').format(floatingDelta.value)}
                </span>
              </span>
            </span>
          </span>
        ) : null}
      </span>
    </>
  );
}

const layoutStyles: Record<
  KpiCardLayout,
  {
    content: string;
    title: string;
    value: string;
    description: string;
    iconContainer: string;
  }
> = {
  default: {
    content:
      'mt-0 flex items-start justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4',
    title:
      'text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs sm:tracking-[0.2em]',
    value: 'mt-1 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl',
    description: 'mt-1 text-xs text-muted-foreground sm:text-sm',
    iconContainer: 'rounded-xl p-2 sm:rounded-2xl sm:p-3',
  },
  compact: {
    content:
      'mt-0 flex items-start justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4',
    title:
      'text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px] sm:tracking-[0.2em]',
    value: 'mt-1 text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl',
    description: 'mt-1 text-xs text-muted-foreground sm:text-sm',
    iconContainer: 'rounded-xl p-2 sm:rounded-2xl sm:p-2.5',
  },
};

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  media,
  trend,
  accentClassName,
  iconContainerClassName,
  className,
  contentClassName,
  valueClassName,
  descriptionClassName,
  loading = false,
  layout = 'default',
}: KpiCardProps) {
  const styles = layoutStyles[layout];
  const displayValue = loading ? (
    '-'
  ) : typeof value === 'number' && Number.isFinite(value) ? (
    <AnimatedValue value={value} />
  ) : (
    value
  );

  return (
    <Card
      className={cn(
        'min-w-0 overflow-hidden border-border/70 py-0 gap-0',
        className
      )}
    >
      <div
        className={cn(
          'h-1 w-full bg-linear-to-r',
          accentClassName ?? fallbackKpiAccentClassName
        )}
      />
      <CardContent
        className={cn(
          styles.content,
          !Icon && !media && 'justify-start',
          contentClassName
        )}
      >
        <div className="min-w-0 flex-1">
          <div className={styles.title}>{title}</div>
          <div className={cn(styles.value, valueClassName)}>{displayValue}</div>
          {description ? (
            <div className={cn(styles.description, descriptionClassName)}>
              {description}
            </div>
          ) : null}
          {trend ? (
            <p
              className={cn(
                'mt-1 text-xs',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          ) : null}
        </div>
        {media ? (
          <div
            className={cn(
              styles.iconContainer,
              'overflow-hidden p-0',
              iconContainerClassName ?? fallbackKpiIconContainerClassName
            )}
          >
            {media}
          </div>
        ) : Icon ? (
          <div
            className={cn(
              styles.iconContainer,
              iconContainerClassName ?? fallbackKpiIconContainerClassName
            )}
          >
            <Icon className="size-4 sm:size-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

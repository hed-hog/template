'use client';

import { Card, CardContent } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type DashboardMetric = { value: number; change: number; changeType: 'percent' | 'absolute' };
type Data = { kpis?: { completionRate?: DashboardMetric } };

export default function CompletionRateKpi({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');
  const locale = useLocale();
  const culture = locale.startsWith('pt') ? 'pt-BR' : 'en-US';

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ kpis: { completionRate: (d as any)?.kpis?.completionRate } }),
  });

  const metric = data?.kpis?.completionRate;
  const value = metric?.value ?? 0;
  const change = metric?.change ?? 0;

  const decimalFmt = useMemo(
    () =>
      new Intl.NumberFormat(culture, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [culture]
  );

  const isPositive = change >= 0;

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.completionRate.label')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/70">
        <div className="h-1 w-full bg-linear-to-r from-pink-500/60 via-pink-400/30 to-transparent" />
        <CardContent className="flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t('kpis.completionRate.label')}
            </p>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pink-500/10">
              <CheckCircle2 className="size-4 text-pink-700" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight">{decimalFmt.format(value)}%</p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {isPositive ? (
                <TrendingUp className="size-3 text-emerald-600" />
              ) : (
                <TrendingDown className="size-3 text-red-500" />
              )}
              <span className={isPositive ? 'text-emerald-600' : 'text-red-500'}>
                {decimalFmt.format(Math.abs(change))}%
              </span>
              <span className="text-muted-foreground">{t('kpis.completionRate.description')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

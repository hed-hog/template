'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface Receivable30dKpiProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  kpis?: {
    aReceber30dias: number;
    aReceber7dias: number;
  };
}

export default function Receivable30dKpi({
  widget,
  onRemove,
}: Receivable30dKpiProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-kpi-receivable-30d',
    });

  const value = data?.kpis?.aReceber30dias ?? 0;
  const sevenDays = data?.kpis?.aReceber7dias ?? 0;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.receivable30.title')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-linear-to-br from-background to-green-50/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100/80">
            <TrendingUp className="h-4.5 w-4.5 text-green-600" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('kpis.receivable30.title')}
            </span>
            <span className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg">
              {formatted}
            </span>
            <span className="truncate text-[9px] text-muted-foreground">
              {t('kpis.receivable30.sevenDays', {
                value: new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(sevenDays),
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

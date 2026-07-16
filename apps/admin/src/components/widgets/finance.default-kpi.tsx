'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface DefaultKpiProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  kpis?: {
    inadimplencia: number;
  };
}

export default function DefaultKpi({ widget, onRemove }: DefaultKpiProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-kpi-default',
    });

  const value = data?.kpis?.inadimplencia ?? 0;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.default.title')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-linear-to-br from-background to-amber-50/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/80">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('kpis.default.title')}
            </span>
            <span className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg">
              {formatted}
            </span>
            <span className="truncate text-[9px] text-muted-foreground">
              {t('kpis.default.description')}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

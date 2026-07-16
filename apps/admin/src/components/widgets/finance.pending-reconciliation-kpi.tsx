'use client';

import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PendingReconciliationKpiProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  extratos?: Array<{
    statusConciliacao?: string | null;
  }>;
  contasBancarias?: Array<{
    ativo?: boolean | null;
  }>;
}

const normalize = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function PendingReconciliationKpi({
  widget,
  onRemove,
}: PendingReconciliationKpiProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-kpi-pending-reconciliation',
    });

  const pendingCount = (data?.extratos || []).filter((statement) =>
    normalize(statement?.statusConciliacao).includes('pend')
  ).length;

  const activeAccounts = (data?.contasBancarias || []).filter(
    (account) => account?.ativo !== false
  ).length;

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.pendingReconciliation.title')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-linear-to-br from-background to-violet-50/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100/80">
            <ArrowLeftRight className="h-4.5 w-4.5 text-violet-600" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('kpis.pendingReconciliation.title')}
            </span>
            <div className="flex items-end gap-2">
              <span className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg">
                {pendingCount}
              </span>
              <span className="mb-0.5 truncate text-[9px] text-muted-foreground">
                {t('kpis.pendingReconciliation.countLabel')}
              </span>
            </div>
            <span className="truncate text-[9px] text-muted-foreground">
              {t('kpis.pendingReconciliation.description', {
                value: activeAccounts,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

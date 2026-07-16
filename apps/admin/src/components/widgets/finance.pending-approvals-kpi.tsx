'use client';

import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PendingApprovalsKpiProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  aprovacoesPendentes?: Array<{
    valor?: number | null;
  }>;
}

export default function PendingApprovalsKpi({
  widget,
  onRemove,
}: PendingApprovalsKpiProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-kpi-pending-approvals',
    });

  const pendingApprovals = data?.aprovacoesPendentes || [];
  const count = pendingApprovals.length;
  const totalValue = pendingApprovals.reduce(
    (acc, item) => acc + Number(item?.valor || 0),
    0
  );
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(totalValue);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.pendingApprovals.title')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-linear-to-br from-background to-sky-50/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100/80">
            <ClipboardList className="h-4.5 w-4.5 text-sky-600" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('kpis.pendingApprovals.title')}
            </span>
            <div className="flex items-end gap-2">
              <span className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg">
                {count}
              </span>
              <span className="mb-0.5 text-[9px] text-muted-foreground">
                {t('kpis.pendingApprovals.countLabel')}
              </span>
            </div>
            <span className="truncate text-[9px] text-muted-foreground">
              {t('kpis.pendingApprovals.description', {
                value: formattedValue,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

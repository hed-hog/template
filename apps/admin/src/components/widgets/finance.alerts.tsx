'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface FinanceData {
  titulosPagar?: Array<{
    status: string;
    parcelas: Array<{ status: string }>;
  }>;
  extratos?: Array<{
    statusConciliacao: string;
  }>;
  periodoAberto?: {
    inicio?: string | null;
  } | null;
}

interface AlertsProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function Alerts({ widget, onRemove }: AlertsProps) {
  const t = useTranslations('finance.DashboardPage');
  const locale = useLocale();

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-alerts',
    });

  const approvedPayables = (data?.titulosPagar || []).filter(
    (titulo) => titulo.status !== 'rascunho' && titulo.status !== 'cancelado'
  );

  const overdue = approvedPayables.filter((titulo) =>
    titulo.parcelas.some((p) => p.status === 'vencido')
  ).length;

  const pendingReconciliation = (data?.extratos || []).filter(
    (e) => e.statusConciliacao === 'pendente'
  ).length;

  const periodBase = data?.periodoAberto?.inicio
    ? new Date(data.periodoAberto.inicio)
    : new Date();
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    periodBase
  );
  const currentPeriod = `${month.charAt(0).toUpperCase()}${month.slice(1)}/${periodBase.getFullYear()}`;

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('alerts.title')}
      onRemove={onRemove}
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            {t('alerts.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {overdue > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <span className="text-sm">{t('alerts.overdueTitles')}</span>
                <Badge variant="destructive">{overdue}</Badge>
              </div>
            )}
            {pendingReconciliation > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-3">
                <span className="text-sm">
                  {t('alerts.pendingReconciliation')}
                </span>
                <Badge
                  variant="outline"
                  className="border-yellow-500 text-yellow-700"
                >
                  {pendingReconciliation}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <span className="text-sm">{t('alerts.openPeriod')}</span>
              <Badge
                variant="outline"
                className="border-blue-500 text-blue-700"
              >
                {currentPeriod}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

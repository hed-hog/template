'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface CashBalanceKpiProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  kpis?: {
    saldoCaixa: number;
    saldoCaixaPorMoeda?: Record<
      string,
      { total: number; reconciled: number; symbol: string; name: string }
    >;
  };
}

export default function CashBalanceKpi({
  widget,
  onRemove,
}: CashBalanceKpiProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-kpi-cash-balance',
    });

  const saldoCaixaPorMoeda = data?.kpis?.saldoCaixaPorMoeda ?? {};
  const currencyEntries = Object.entries(saldoCaixaPorMoeda);
  // Fallback to the legacy single-value when the new field is absent
  const legacyValue = data?.kpis?.saldoCaixa ?? 0;
  const hasCurrencyBreakdown = currencyEntries.length > 0;

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('kpis.cashBalance.title')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-linear-to-br from-background to-emerald-50/40 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80">
            <Wallet className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('kpis.cashBalance.title')}
            </span>
            {hasCurrencyBreakdown ? (
              currencyEntries.map(([code, entry]) => (
                <span
                  key={code}
                  className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg"
                >
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: code,
                  }).format(entry.total)}
                </span>
              ))
            ) : (
              <span className="truncate text-base font-bold leading-none tracking-tight text-foreground sm:text-lg">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(legacyValue)}
              </span>
            )}
            <span className="truncate text-[9px] text-muted-foreground">
              {t('kpis.cashBalance.description')}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

'use client';

import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { useWidgetData } from '@/hooks/use-widget-data';
import { Landmark } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ReconciliationWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface FinanceData {
  extratos?: Array<{
    statusConciliacao?: string | null;
  }>;
  contasBancarias?: Array<{
    id: string;
    banco?: string | null;
    nome?: string | null;
    saldoAtual?: number | null;
    saldoConciliado?: number | null;
    ativo?: boolean | null;
    currency?: { code: string; symbol: string } | null;
  }>;
}

const normalize = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function BankReconciliationStatus({
  widget,
  onRemove,
}: ReconciliationWidgetProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-bank-reconciliation-status',
    });

  const statements = data?.extratos || [];
  const bankAccounts = (data?.contasBancarias || []).filter(
    (account) => account?.ativo !== false
  );

  const pendingCount = statements.filter((statement) =>
    normalize(statement?.statusConciliacao).includes('pend')
  ).length;
  const reconciledCount = Math.max(statements.length - pendingCount, 0);

  const accountDiffs = bankAccounts
    .map((account) => ({
      id: account.id,
      name: account.nome || account.banco || t('bankReconciliation.unnamedAccount'),
      difference: Math.abs(
        Number(account.saldoAtual || 0) - Number(account.saldoConciliado || 0)
      ),
      currencyCode: account.currency?.code ?? 'BRL',
      currencySymbol: account.currency?.symbol ?? 'R$',
    }))
    .sort((a, b) => b.difference - a.difference);

  // Group differences by currency — never mix different currencies in a single total
  const differencesByCurrency = accountDiffs.reduce<
    Record<string, { total: number; symbol: string }>
  >((acc, account) => {
    const code = account.currencyCode;
    if (!acc[code]) {
      acc[code] = { total: 0, symbol: account.currencySymbol };
    }
    acc[code].total += account.difference;
    return acc;
  }, {});

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('bankReconciliation.title')}
      onRemove={onRemove}
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-sky-600" />
            {t('bankReconciliation.title')}
          </CardTitle>
          <CardDescription>{t('bankReconciliation.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 pt-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {t('bankReconciliation.pending')}: {pendingCount}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {t('bankReconciliation.reconciled')}: {reconciledCount}
            </Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {t('bankReconciliation.accounts')}: {bankAccounts.length}
            </Badge>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t('bankReconciliation.difference')}
            </p>
            {Object.entries(differencesByCurrency).length > 0 ? (
              Object.entries(differencesByCurrency).map(([code, entry]) => (
                <p key={code} className="text-lg font-semibold text-foreground tabular-nums">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: code,
                  }).format(entry.total)}
                </p>
              ))
            ) : (
              <p className="text-lg font-semibold text-foreground tabular-nums">
                <Money value={0} />
              </p>
            )}
          </div>

          <div className="space-y-2">
            {accountDiffs.slice(0, 3).map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
              >
                <span className="truncate pr-3 text-sm text-foreground">
                  {account.name}
                </span>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: account.currencyCode,
                  }).format(account.difference)}
                </span>
              </div>
            ))}

            {accountDiffs.length === 0 && (
              <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-700">
                {t('bankReconciliation.allClear')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

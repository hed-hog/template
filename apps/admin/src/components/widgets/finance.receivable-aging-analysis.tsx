'use client';

import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { useWidgetData } from '@/hooks/use-widget-data';
import { BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AgingWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface AgingItem {
  bucket0_30?: number | null;
  bucket31_60?: number | null;
  bucket61_90?: number | null;
  bucket90plus?: number | null;
  total?: number | null;
}

interface FinanceData {
  agingInadimplencia?: AgingItem[];
}

export default function ReceivableAgingAnalysis({
  widget,
  onRemove,
}: AgingWidgetProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-receivable-aging-analysis',
    });

  const agingItems = data?.agingInadimplencia || [];

  const totals = {
    bucket0to30: agingItems.reduce(
      (acc, item) => acc + Number(item?.bucket0_30 || 0),
      0
    ),
    bucket31to60: agingItems.reduce(
      (acc, item) => acc + Number(item?.bucket31_60 || 0),
      0
    ),
    bucket61to90: agingItems.reduce(
      (acc, item) => acc + Number(item?.bucket61_90 || 0),
      0
    ),
    bucket90plus: agingItems.reduce(
      (acc, item) => acc + Number(item?.bucket90plus || 0),
      0
    ),
    total: agingItems.reduce((acc, item) => acc + Number(item?.total || 0), 0),
    clients: agingItems.length,
  };

  const buckets = [
    {
      label: t('aging.range0to30'),
      value: totals.bucket0to30,
      colorClass: 'bg-amber-400',
    },
    {
      label: t('aging.range31to60'),
      value: totals.bucket31to60,
      colorClass: 'bg-orange-400',
    },
    {
      label: t('aging.range61to90'),
      value: totals.bucket61to90,
      colorClass: 'bg-rose-400',
    },
    {
      label: t('aging.range90plus'),
      value: totals.bucket90plus,
      colorClass: 'bg-red-500',
    },
  ];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('aging.title')}
      onRemove={onRemove}
    >
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="pb-1.5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-rose-500" />
            {t('aging.title')}
          </CardTitle>
          <CardDescription className="line-clamp-1 text-xs">
            {t('aging.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 overflow-hidden pt-0">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('aging.totalLabel')}
              </p>
              <p className="text-sm font-semibold text-foreground sm:text-base">
                <Money value={totals.total} />
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('aging.clientsLabel')}
              </p>
              <p className="text-sm font-semibold text-foreground sm:text-base">
                {totals.clients}
              </p>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-2 gap-2">
            {buckets.map((bucket) => {
              const percentage =
                totals.total > 0 ? (bucket.value / totals.total) * 100 : 0;

              return (
                <div
                  key={bucket.label}
                  className="rounded-md border border-border/60 bg-background/70 p-2"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-[11px] leading-4 text-muted-foreground">
                      {bucket.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-foreground">
                      <Money value={bucket.value} />
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${bucket.colorClass}`}
                      style={{
                        width: `${Math.max(percentage, bucket.value > 0 ? 8 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

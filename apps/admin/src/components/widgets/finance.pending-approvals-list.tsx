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
import { ClipboardCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface PendingApprovalsListProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

interface ApprovalItem {
  id: string;
  tituloId?: string;
  valor?: number | null;
  politica?: string | null;
  urgencia?: string | null;
  dataSolicitacao?: string | null;
}

interface FinanceData {
  aprovacoesPendentes?: ApprovalItem[];
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('pt-BR');
}

export default function PendingApprovalsList({
  widget,
  onRemove,
}: PendingApprovalsListProps) {
  const t = useTranslations('finance.DashboardPage');
  const approvalT = useTranslations('finance.PayableApprovalsPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-pending-approvals-list',
    });

  const rows = [...(data?.aprovacoesPendentes || [])]
    .sort(
      (a, b) =>
        new Date(b?.dataSolicitacao || 0).getTime() -
        new Date(a?.dataSolicitacao || 0).getTime()
    )
    .slice(0, 4);

  const defaultUrgency = {
    label: approvalT('urgency.medium'),
    className: 'bg-blue-100 text-blue-700',
  };

  const urgencyConfig: Record<
    string,
    { label: string; className: string }
  > = {
    baixa: {
      label: approvalT('urgency.low'),
      className: 'bg-slate-100 text-slate-700',
    },
    media: defaultUrgency,
    alta: {
      label: approvalT('urgency.high'),
      className: 'bg-orange-100 text-orange-700',
    },
    critica: {
      label: approvalT('urgency.critical'),
      className: 'bg-red-100 text-red-700',
    },
  };

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('approvalQueue.title')}
      onRemove={onRemove}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-sky-600" />
            {t('approvalQueue.title')}
          </CardTitle>
          <CardDescription>{t('approvalQueue.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {rows.map((item) => {
              const urgency =
                urgencyConfig[String(item.urgencia || 'media').toLowerCase()] ??
                defaultUrgency;

              return (
                <Link
                  key={item.id}
                  href="/finance/accounts-payable/approvals"
                  className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.politica || t('approvalQueue.defaultPolicy')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(item.dataSolicitacao)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm font-medium text-foreground">
                      <Money value={Number(item.valor || 0)} />
                    </div>
                    <Badge className={urgency.className}>{urgency.label}</Badge>
                  </div>
                </Link>
              );
            })}

            {rows.length === 0 && (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-sm text-muted-foreground">
                {t('approvalQueue.empty')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

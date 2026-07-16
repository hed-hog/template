'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/status-badge';
import { useWidgetData } from '@/hooks/use-widget-data';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface FinanceData {
  titulosReceber?: Array<{
    id: string;
    documento: string;
    clienteId?: string;
    parcelas: Array<{
      status: string;
      vencimento: string;
      valor: number;
    }>;
  }>;
  pessoas?: Array<{
    id: string;
    nome: string;
  }>;
}

interface UpcomingReceivableProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function UpcomingReceivable({
  widget,
  onRemove,
}: UpcomingReceivableProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-upcoming-receivable',
    });

  const getPersonById = (id?: string) =>
    (data?.pessoas || []).find((p) => p.id === id);

  const rows = (data?.titulosReceber || [])
    .flatMap((titulo) =>
      titulo.parcelas
        .filter((p) => p.status === 'aberto' || p.status === 'vencido')
        .map((parcela) => ({
          tituloId: titulo.id,
          documento: titulo.documento,
          person: getPersonById(titulo.clienteId)?.nome || '',
          dueDate: parcela.vencimento,
          value: parcela.valor,
          status: parcela.status,
        }))
    )
    .slice(0, 3);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('upcoming.receivable')}
      onRemove={onRemove}
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpRight className="h-4 w-4 text-green-500" />
            {t('upcoming.receivable')}
          </CardTitle>
          <CardDescription>{t('upcoming.nextDueDates')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rows.map((item, index) => (
              <Link
                key={index}
                href={`/finance/accounts-receivable/installments/${item.tituloId}`}
                className="-m-2 flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.documento}</p>
                  <p className="text-xs text-muted-foreground">{item.person}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    <Money value={item.value} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.dueDate)}
                  </p>
                </div>
                <StatusBadge status={item.status as any} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

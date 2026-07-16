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
import { ArrowDownRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface FinanceData {
  titulosPagar?: Array<{
    id: string;
    status: string;
    documento: string;
    fornecedorId?: string;
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

interface UpcomingPayableProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function UpcomingPayable({
  widget,
  onRemove,
}: UpcomingPayableProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-upcoming-payable',
    });

  const getPersonById = (id?: string) =>
    (data?.pessoas || []).find((p) => p.id === id);

  const approvedPayables = (data?.titulosPagar || []).filter(
    (titulo) => titulo.status !== 'rascunho' && titulo.status !== 'cancelado'
  );

  const rows = approvedPayables
    .flatMap((titulo) =>
      titulo.parcelas
        .filter((p) => p.status === 'aberto' || p.status === 'vencido')
        .map((parcela) => ({
          tituloId: titulo.id,
          documento: titulo.documento,
          person: getPersonById(titulo.fornecedorId)?.nome || '',
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
      widgetName={widget?.name || t('upcoming.payable')}
      onRemove={onRemove}
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownRight className="h-4 w-4 text-red-500" />
            {t('upcoming.payable')}
          </CardTitle>
          <CardDescription>{t('upcoming.nextDueDates')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rows.map((item, index) => (
              <Link
                key={index}
                href={`/finance/accounts-payable/installments/${item.tituloId}`}
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

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface CashFlowPoint {
  data: string;
  saldoPrevisto: number;
  saldoRealizado: number;
}

interface FinanceData {
  fluxoCaixaPrevisto?: CashFlowPoint[];
}

interface CashFlowChartProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function CashFlowChart({
  widget,
  onRemove,
}: CashFlowChartProps) {
  const t = useTranslations('finance.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<FinanceData>({
      endpoint: '/finance/data',
      queryKey: 'finance-cash-flow-chart',
    });

  const chartData = (data?.fluxoCaixaPrevisto || []).map((item) => ({
    ...item,
    data: new Date(item.data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('cashFlow.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('cashFlow.title')}</CardTitle>
          <CardDescription>{t('cashFlow.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(value)
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="saldoPrevisto"
                  name={t('chart.predicted')}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="saldoRealizado"
                  name={t('chart.actual')}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

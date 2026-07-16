'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type CategoryItem = { name: string; value: number };
type Data = { charts?: { categoryDistribution?: CategoryItem[] } };

const PIE_COLORS = [
  '#f97316',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ec4899',
];

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function CategoryDistributionChart({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ charts: { categoryDistribution: (d as any)?.charts?.categoryDistribution } }),
  });

  const chartData = useMemo(
    () =>
      (data?.charts?.categoryDistribution ?? []).map((item) => ({
        nome: item.name,
        valor: item.value,
      })),
    [data]
  );

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.categoryDistribution.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('charts.categoryDistribution.title')}
          </CardTitle>
          <CardDescription>{t('charts.categoryDistribution.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center pt-0">
          <div className="w-full flex-1">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="valor"
                  nameKey="nome"
                  strokeWidth={3}
                  stroke="hsl(var(--background))"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => [
                    `${value}%`,
                    t('charts.categoryDistribution.tooltip'),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
            {chartData.map((item, i) => (
              <div key={item.nome} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-muted-foreground">
                  {item.nome} ({item.valor}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

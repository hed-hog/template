'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type GrowthItem = { label: string; students: number };
type Data = { charts?: { studentGrowth?: GrowthItem[] } };

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function StudentGrowthChart({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ charts: { studentGrowth: (d as any)?.charts?.studentGrowth } }),
  });

  const chartData = useMemo(
    () =>
      (data?.charts?.studentGrowth ?? []).map((item) => ({
        mes: item.label,
        alunos: item.students,
      })),
    [data]
  );

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.studentGrowth.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('charts.studentGrowth.title')}
          </CardTitle>
          <CardDescription>{t('charts.studentGrowth.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line
                type="monotone"
                dataKey="alunos"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
                name={t('charts.studentGrowth.series')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

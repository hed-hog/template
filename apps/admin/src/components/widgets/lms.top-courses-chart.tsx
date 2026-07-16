'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type TopCourseItem = { title: string; accesses: number };
type Data = { charts?: { topCourses?: TopCourseItem[] } };

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function TopCoursesChart({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ charts: { topCourses: (d as any)?.charts?.topCourses } }),
  });

  const chartData = useMemo(
    () =>
      (data?.charts?.topCourses ?? []).map((item) => ({
        curso: item.title,
        acessos: item.accesses,
      })),
    [data]
  );

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.topCourses.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('charts.topCourses.title')}
          </CardTitle>
          <CardDescription>{t('charts.topCourses.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={false}
              />
              <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="curso"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <defs>
                <linearGradient id="topCoursesBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
              <Bar
                dataKey="acessos"
                fill="url(#topCoursesBar)"
                radius={[0, 6, 6, 0]}
                name={t('charts.topCourses.series')}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

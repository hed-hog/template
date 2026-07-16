'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
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

type EngagementItem = { label: string; accesses: number; videos: number; exercises: number };
type Data = { charts?: { engagement?: EngagementItem[] } };

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function EngagementChart({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ charts: { engagement: (d as any)?.charts?.engagement } }),
  });

  const chartData = useMemo(
    () =>
      (data?.charts?.engagement ?? []).map((item) => ({
        semana: item.label,
        acessos: item.accesses,
        videoAssistidos: item.videos,
        exercicios: item.exercises,
      })),
    [data]
  );

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.engagement.title')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t('charts.engagement.title')}
          </CardTitle>
          <CardDescription>{t('charts.engagement.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="engColorAcessos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="engColorVideos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="engColorExercicios" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area
                type="monotone"
                dataKey="acessos"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#engColorAcessos)"
                name={t('charts.engagement.series.accesses')}
              />
              <Area
                type="monotone"
                dataKey="videoAssistidos"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#engColorVideos)"
                name={t('charts.engagement.series.videos')}
              />
              <Area
                type="monotone"
                dataKey="exercicios"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#engColorExercicios)"
                name={t('charts.engagement.series.exercises')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

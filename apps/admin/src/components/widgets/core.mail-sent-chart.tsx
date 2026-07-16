'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { IconGripVertical } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  const t = useTranslations('core.Dashboard');
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-medium text-card-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#3b82f6' }}
          />
          {t('sent')}: {entry.value.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
}

interface EmailStatsChartProps {
  widget?: any;
  onRemove?: () => void;
}

interface MailStatsData {
  charts?: {
    emailsPerWeek?: Array<{
      day: string;
      sent: number;
    }>;
  };
}

export default function EmailStatsChart({
  widget,
  onRemove,
}: EmailStatsChartProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<MailStatsData>({
      endpoint: '/dashboard-core/stats/overview/mails',
      queryKey: 'dashboard-stats-mails',
    });

  const chartData = data?.charts?.emailsPerWeek || [];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('emailSendingTitle')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col group">
        <div
          className="drag-handle absolute top-3 left-4 z-10"
          style={{ cursor: 'grab' }}
        >
          <IconGripVertical className="text-muted-foreground/50 size-4 shrink-0" />
        </div>
        <CardHeader className="pb-2 pt-4 pl-10">
          <CardTitle className="text-base font-semibold">
            {t('emailSendingTitle')}
          </CardTitle>
          <CardDescription>{t('emailSendingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="sent"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: '#3b82f6' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('emailsSent')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

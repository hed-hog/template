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
  CartesianGrid,
  Line,
  LineChart,
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
            style={{
              backgroundColor:
                entry.dataKey === 'active' ? '#10b981' : '#f59e0b',
            }}
          />
          {entry.dataKey === 'active' ? t('active') : t('expired')}:{' '}
          {entry.value}
        </p>
      ))}
    </div>
  );
}

interface SessionActivityChartProps {
  widget?: any;
  onRemove?: () => void;
}

interface UserStatsData {
  charts?: {
    sessionActivity?: Array<{
      hour: string;
      active: number;
      expired: number;
    }>;
  };
}

export default function SessionActivityChart({
  widget,
  onRemove,
}: SessionActivityChartProps) {
  const t = useTranslations('core.Dashboard');

  const {
    data: statsData,
    isLoading,
    isAccessDenied,
    isError,
  } = useWidgetData<UserStatsData>({
    endpoint: '/dashboard-core/stats/overview/users',
    queryKey: 'dashboard-stats-users',
  });

  const data = statsData?.charts?.sessionActivity || [];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('sessionActivityTitle')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col group">
        <div
          className="drag-handle absolute top-3 left-4 z-10"
          style={{ cursor: 'grab' }}
        >
          <IconGripVertical className="text-muted-foreground/50 size-4 shrink-0" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
          <div className="pl-6">
            <CardTitle className="text-base font-semibold">
              {t('sessionActivityTitle')}
            </CardTitle>
            <CardDescription>{t('sessionActivityDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#10b981' }}
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="expired"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  strokeDasharray="5 5"
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                  animationDuration={1500}
                  animationBegin={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: '#10b981' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('active')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: '#f59e0b' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('expired')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

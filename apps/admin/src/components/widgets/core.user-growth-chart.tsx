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
  Area,
  AreaChart,
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
            style={{
              backgroundColor:
                entry.dataKey === 'users' ? '#6366f1' : '#10b981',
            }}
          />
          {entry.dataKey === 'users' ? t('users') : t('sessions')}:{' '}
          {entry.value.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  );
}

interface UserGrowthChartProps {
  widget?: any;
  onRemove?: () => void;
}

interface UserStatsData {
  charts?: {
    userGrowth?: Array<{
      month: string;
      users: number;
      sessions: number;
    }>;
  };
}

export default function UserGrowthChart({
  widget,
  onRemove,
}: UserGrowthChartProps) {
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

  const data = statsData?.charts?.userGrowth || [];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('userGrowthTitle')}
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
              {t('userGrowthTitle')}
            </CardTitle>
            <CardDescription>{t('userGrowthDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="gradientUsuarios"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient
                    id="gradientSessoes"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop
                      offset="100%"
                      stopColor="#10b981"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  dataKey="month"
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
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#gradientSessoes)"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#gradientUsuarios)"
                  animationDuration={1500}
                  animationBegin={200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: '#6366f1' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('users')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: '#10b981' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('sessions')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

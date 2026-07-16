'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useWidgetData } from '@/hooks/use-widget-data';
import type { AllWidgetsData, LoginDay } from '@/types/widget-data';
import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

function LoginChart({ data }: { data: LoginDay[] }) {
  const t = useTranslations('core.DashboardPage.loginHistory');

  const chartConfig = {
    logins: { label: t('logins'), color: 'hsl(221, 83%, 53%)' },
    failed: { label: t('failed'), color: 'hsl(0, 84%, 60%)' },
  };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5" />
          <div>
            <CardTitle className="text-sm font-semibold sm:text-base">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
        <ChartContainer
          config={chartConfig}
          className="h-full min-h-[140px] w-full flex-1 overflow-hidden sm:min-h-40"
        >
          <BarChart data={data as any} barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              tickMargin={4}
              minTickGap={20}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={10}
              tickMargin={4}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="logins"
              fill="hsl(221, 83%, 53%)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="failed"
              fill="hsl(0, 84%, 60%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface LoginHistoryChartProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function LoginHistoryChart({
  widget,
  onRemove,
}: LoginHistoryChartProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    LoginDay[]
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.loginHistory,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'login-history-chart'}
      onRemove={onRemove}
    >
      {data && <LoginChart data={data} />}
    </WidgetWrapper>
  );
}

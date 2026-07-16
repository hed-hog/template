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
import type {
  AllWidgetsData,
  EmailNotificationsData,
} from '@/types/widget-data';
import { Mail, MailCheck, MailWarning, MailX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const defaultEmailNotificationsData: EmailNotificationsData = {
  cards: {
    received: 0,
    read: 0,
    unread: 0,
    error: 0,
  },
  chart: [],
};

interface EmailNotificationsProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function EmailNotifications({
  widget,
  onRemove,
}: EmailNotificationsProps) {
  const t = useTranslations('core.DashboardPage.emailNotifications');

  const chartConfig = {
    recebidos: {
      label: t('received'),
      color: 'hsl(221, 83%, 53%)',
    },
    lidos: {
      label: t('read'),
      color: 'hsl(160, 84%, 39%)',
    },
  };

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    EmailNotificationsData
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.emailNotifications,
  });

  const widgetData = data ?? defaultEmailNotificationsData;
  const chartData = widgetData.chart.map((point) => ({
    date: point.date,
    recebidos: point.received ?? 0,
    lidos: point.read ?? 0,
  }));

  const emailStats = [
    {
      label: t('received'),
      shortLabel: t('receivedShort'),
      value: widgetData.cards.received ?? 0,
      icon: Mail,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: t('read'),
      shortLabel: t('readShort'),
      value: widgetData.cards.read ?? 0,
      icon: MailCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: t('unread'),
      shortLabel: t('unreadShort'),
      value: widgetData.cards.unread ?? 0,
      icon: MailWarning,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      label: t('error'),
      shortLabel: t('errorShort'),
      value: widgetData.cards.error ?? 0,
      icon: MailX,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/40',
    },
  ];

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? t('title')}
      onRemove={onRemove}
    >
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-rose-600 dark:text-rose-400 sm:h-5 sm:w-5" />
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-4">
            {emailStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors hover:bg-muted/30 sm:p-2.5"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md sm:h-7 sm:w-7 ${stat.bg}`}
                  >
                    <Icon
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${stat.color}`}
                    />
                  </div>
                  <span className="text-base font-bold text-foreground sm:text-lg">
                    {stat.value}
                  </span>
                  <span className="truncate text-[9px] text-muted-foreground sm:text-[10px]">
                    <span className="sm:hidden">{stat.shortLabel}</span>
                    <span className="hidden sm:inline">{stat.label}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <ChartContainer
            config={chartConfig}
            className="min-h-42.5 w-full flex-1 overflow-hidden sm:min-h-55"
          >
            <AreaChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickMargin={4}
                minTickGap={20}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickMargin={4}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <defs>
                <linearGradient id="fillRecebidos" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(221, 83%, 53%)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(221, 83%, 53%)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="fillLidos" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(160, 84%, 39%)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(160, 84%, 39%)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="recebidos"
                stroke="hsl(221, 83%, 53%)"
                fill="url(#fillRecebidos)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="lidos"
                stroke="hsl(160, 84%, 39%)"
                fill="url(#fillLidos)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

import { useWidgetData } from '@/hooks/use-widget-data';
import { Activity } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface SessionsTodayProps {
  widget?: any;
  onRemove?: () => void;
}

interface UserStatsData {
  cards?: {
    sessionsToday?: {
      value: number;
      change: number | null;
    };
  };
}

export default function SessionsToday({
  widget,
  onRemove,
}: SessionsTodayProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<UserStatsData>({
      endpoint: '/dashboard-core/stats/overview/users',
      queryKey: 'dashboard-stats-users',
    });

  const value =
    data?.cards?.sessionsToday?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.sessionsToday?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('sessionsToday')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('sessionsToday')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<Activity className="h-6 w-6 text-emerald-500" />}
        iconBg="bg-emerald-500/10"
        delay={100}
      />
    </WidgetWrapper>
  );
}

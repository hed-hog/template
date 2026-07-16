import { useWidgetData } from '@/hooks/use-widget-data';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface ActiveUsersProps {
  widget?: any;
  onRemove?: () => void;
}

interface UserStatsData {
  cards?: {
    activeUsers?: {
      value: number;
      change: number | null;
    };
  };
}

export default function ActiveUsers({ widget, onRemove }: ActiveUsersProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<UserStatsData>({
      endpoint: '/dashboard-core/stats/overview/users',
      queryKey: 'dashboard-stats-users',
    });

  const value = data?.cards?.activeUsers?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.activeUsers?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('activeUsers')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('activeUsers')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<Users className="h-6 w-6 text-blue-500" />}
        iconBg="bg-blue-500/10"
        delay={50}
      />
    </WidgetWrapper>
  );
}

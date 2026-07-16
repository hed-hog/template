import { useWidgetData } from '@/hooks/use-widget-data';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface PermissionsCardProps {
  widget?: any;
  onRemove?: () => void;
}

interface UserStatsData {
  cards?: {
    roles?: {
      value: number;
      change: number | null;
    };
  };
}

export default function PermissionsCard({
  widget,
  onRemove,
}: PermissionsCardProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<UserStatsData>({
      endpoint: '/dashboard-core/stats/overview/users',
      queryKey: 'dashboard-stats-users',
    });

  const value = data?.cards?.roles?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.roles?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('permissions')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('permissions')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<Shield className="h-6 w-6 text-rose-500" />}
        iconBg="bg-rose-500/10"
        delay={200}
      />
    </WidgetWrapper>
  );
}

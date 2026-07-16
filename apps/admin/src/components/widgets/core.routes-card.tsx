import { useWidgetData } from '@/hooks/use-widget-data';
import { Route } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface RoutesCardProps {
  widget?: any;
  onRemove?: () => void;
}

interface SystemStatsData {
  cards?: {
    routes?: {
      value: number;
      change: number | null;
    };
  };
}

export default function RoutesCard({ widget, onRemove }: RoutesCardProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<SystemStatsData>({
      endpoint: '/dashboard-core/stats/overview/system',
      queryKey: 'dashboard-stats-system',
    });

  const value = data?.cards?.routes?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.routes?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('routes')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('routes')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<Route className="h-6 w-6 text-orange-500" />}
        iconBg="bg-orange-500/10"
        delay={50}
      />
    </WidgetWrapper>
  );
}

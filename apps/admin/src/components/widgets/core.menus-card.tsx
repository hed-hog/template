import { useWidgetData } from '@/hooks/use-widget-data';
import { LayoutList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface MenusCardProps {
  widget?: any;
  onRemove?: () => void;
}

interface SystemStatsData {
  cards?: {
    menus?: {
      value: number;
      change: number | null;
    };
  };
}

export default function MenusCard({ widget, onRemove }: MenusCardProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<SystemStatsData>({
      endpoint: '/dashboard-core/stats/overview/system',
      queryKey: 'dashboard-stats-system',
    });

  const value = data?.cards?.menus?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.menus?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('menus')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('menus')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<LayoutList className="h-6 w-6 text-green-500" />}
        iconBg="bg-green-500/10"
        delay={50}
      />
    </WidgetWrapper>
  );
}

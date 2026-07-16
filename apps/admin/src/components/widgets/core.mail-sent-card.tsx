import { useWidgetData } from '@/hooks/use-widget-data';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatCard from '@/app/(app)/(libraries)/core/dashboard/components/stats';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface MailSentProps {
  widget?: any;
  onRemove?: () => void;
}

interface MailStatsData {
  cards?: {
    emailsSent?: {
      value: number;
      change: number | null;
    };
  };
}

export default function MailSent({ widget, onRemove }: MailSentProps) {
  const t = useTranslations('core.Dashboard');

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<MailStatsData>({
      endpoint: '/dashboard-core/stats/overview/mails',
      queryKey: 'dashboard-stats-mails',
    });

  const value = data?.cards?.emailsSent?.value?.toLocaleString('pt-BR') || '0';
  const change = data?.cards?.emailsSent?.change;
  const changeType =
    change !== null && change !== undefined && change >= 0 ? 'up' : 'down';

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('emailsSent')}
      onRemove={onRemove}
    >
      <StatCard
        title={t('emailsSent')}
        value={value}
        change={
          change !== null && change !== undefined
            ? `${change > 0 ? '+' : ''}${change}%`
            : undefined
        }
        changeType={changeType}
        icon={<Mail className="h-6 w-6 text-amber-500" />}
        iconBg="bg-amber-500/10"
        delay={150}
      />
    </WidgetWrapper>
  );
}

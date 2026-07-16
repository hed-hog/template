'use client';

import { CrmDashboardKpiGrid } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import {
  emptyDashboard,
  useContactDashboardWidgetData,
} from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface OverviewKpisWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function OverviewKpisWidget({
  widget,
  onRemove,
}: OverviewKpisWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = emptyDashboard,
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData({
    queryKey: 'overview-kpis',
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('title')}
      onRemove={onRemove}
    >
      <div className="h-full p-1">
        <CrmDashboardKpiGrid
          dashboard={data}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          cardClassName="h-full"
        />
      </div>
    </WidgetWrapper>
  );
}

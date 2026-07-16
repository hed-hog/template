'use client';

import { CrmTopOwnersCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import type { DashboardResponse } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-types';
import { useContactDashboardWidgetData } from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface TopOwnersWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function TopOwnersWidget({
  widget,
  onRemove,
}: TopOwnersWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = [],
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData<
    DashboardResponse['charts']['owner_performance']
  >({
    queryKey: 'top-owners',
    select: (dashboard) => dashboard.charts.owner_performance,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('bestOwners.title')}
      onRemove={onRemove}
    >
      <CrmTopOwnersCard items={data} className="h-full" />
    </WidgetWrapper>
  );
}

'use client';

import { CrmNextActionsCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import type { DashboardResponse } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-types';
import { useContactDashboardWidgetData } from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface NextActionsWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function NextActionsWidget({
  widget,
  onRemove,
}: NextActionsWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = [],
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData<DashboardResponse['lists']['next_actions']>({
    queryKey: 'next-actions',
    select: (dashboard) => dashboard.lists.next_actions,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('blocks.nextActions.title')}
      onRemove={onRemove}
    >
      <CrmNextActionsCard items={data} className="h-full" />
    </WidgetWrapper>
  );
}

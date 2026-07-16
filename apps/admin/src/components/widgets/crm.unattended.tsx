'use client';

import { CrmUnattendedCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import type { DashboardResponse } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-types';
import { useContactDashboardWidgetData } from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface UnattendedWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function UnattendedWidget({
  widget,
  onRemove,
}: UnattendedWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = [],
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData<DashboardResponse['lists']['unattended']>({
    queryKey: 'unattended',
    select: (dashboard) => dashboard.lists.unattended,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('blocks.unattended.title')}
      onRemove={onRemove}
    >
      <CrmUnattendedCard items={data} className="h-full" />
    </WidgetWrapper>
  );
}

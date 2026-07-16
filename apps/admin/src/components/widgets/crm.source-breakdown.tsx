'use client';

import { CrmSourceBreakdownCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import { useContactDashboardWidgetData } from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import type { DashboardResponse } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-types';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface SourceBreakdownWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function SourceBreakdownWidget({
  widget,
  onRemove,
}: SourceBreakdownWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = [],
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData<DashboardResponse['charts']['source']>({
    queryKey: 'source-breakdown',
    select: (dashboard) => dashboard.charts.source,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.source.title')}
      onRemove={onRemove}
    >
      <CrmSourceBreakdownCard items={data} className="h-full" />
    </WidgetWrapper>
  );
}

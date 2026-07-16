'use client';

import { CrmStageChartCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import { useContactDashboardWidgetData } from '@/app/(app)/(libraries)/crm/dashboard/_components/use-crm-dashboard-data';
import type { DashboardResponse } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-types';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface StageDistributionWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function StageDistributionWidget({
  widget,
  onRemove,
}: StageDistributionWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');
  const {
    data = [],
    isLoading,
    isAccessDenied,
    isError,
  } = useContactDashboardWidgetData<DashboardResponse['charts']['stage']>({
    queryKey: 'stage-distribution',
    select: (dashboard) => dashboard.charts.stage,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('charts.stage.title')}
      onRemove={onRemove}
    >
      <CrmStageChartCard items={data} className="h-full" />
    </WidgetWrapper>
  );
}

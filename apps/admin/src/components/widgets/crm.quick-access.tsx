'use client';

import { CrmQuickAccessCard } from '@/app/(app)/(libraries)/crm/dashboard/_components/dashboard-widgets';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface QuickAccessWidgetProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function QuickAccessWidget({
  widget,
  onRemove,
}: QuickAccessWidgetProps) {
  const t = useTranslations('contact.CrmDashboard');

  return (
    <WidgetWrapper
      isLoading={false}
      isAccessDenied={false}
      isError={false}
      widgetName={widget?.name || t('blocks.quickAccess.title')}
      onRemove={onRemove}
    >
      <CrmQuickAccessCard className="h-full" />
    </WidgetWrapper>
  );
}

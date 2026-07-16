'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import type { AllWidgetsData } from '@/types/widget-data';
import { Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

interface StatAccessLevelProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function StatAccessLevel({
  widget,
  onRemove,
}: StatAccessLevelProps) {
  const t = useTranslations('core.DashboardPage.quickStats');
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    number
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.quickStats.securityLevel,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'stat-access-level'}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3 md:gap-4 md:p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 sm:h-9 sm:w-9 md:h-11 md:w-11">
            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 sm:h-4 sm:w-4 md:h-5 md:w-5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {t('accessLevel')}
            </span>
            <span className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg md:text-2xl">
              {data ? t('accessLevelValue', { level: data }) : '—'}
            </span>
            <span className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
              {t('accessLevelSubtitle')}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

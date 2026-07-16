'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

interface Props {
  widget?: { name?: string };
  onRemove?: () => void;
}

type FooterSummary = {
  activeClasses: number;
  publishedCourses: number;
  enrolledStudents: number;
  certificates: number;
};

type Data = { footerSummary?: FooterSummary };

export default function FooterSummary({ widget, onRemove }: Props) {
  const t = useTranslations('lms.DashboardPage');
  const locale = useLocale();
  const culture = locale.startsWith('pt') ? 'pt-BR' : 'en-US';

  const { data, isLoading, isAccessDenied, isError } = useWidgetData<Data>({
    endpoint: '/lms/dashboard',
    queryKey: 'lms-dashboard',
    select: (d) => ({ footerSummary: (d as any)?.footerSummary }),
  });

  const numberFmt = useMemo(() => new Intl.NumberFormat(culture), [culture]);
  const summary = data?.footerSummary;

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('footer.systemStatus')}
      onRemove={onRemove}
    >
      <Card className="h-full overflow-hidden border-border/70">
        <CardContent className="flex h-full flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2.5">
            <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              {t('footer.systemStatus')}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t('footer.activeClasses', {
                count: numberFmt.format(summary?.activeClasses ?? 0),
              })}
            </span>
            <span>
              {t('footer.publishedCourses', {
                count: numberFmt.format(summary?.publishedCourses ?? 0),
              })}
            </span>
            <span>
              {t('footer.enrolledStudents', {
                count: numberFmt.format(summary?.enrolledStudents ?? 0),
              })}
            </span>
            <span>
              {t('footer.certificates', {
                count: numberFmt.format(summary?.certificates ?? 0),
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

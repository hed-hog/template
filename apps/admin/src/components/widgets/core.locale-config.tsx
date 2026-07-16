'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import type {
  DashboardCoreConfigOverviewData,
  LocaleConfigWidgetData,
} from '@/types/widget-data';
import { Calendar, Clock, Globe, Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const defaultLocaleConfigData: LocaleConfigWidgetData = {
  status: {
    isConfigured: false,
    enabledLocaleCount: 0,
    disabledLocaleCount: 0,
  },
  settings: {
    dateFormat: null,
    timeFormat: null,
    timezone: null,
  },
  locales: [],
};

interface LocaleConfigProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function LocaleConfig({ widget, onRemove }: LocaleConfigProps) {
  const t = useTranslations('core.DashboardPage.localeConfig');

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    DashboardCoreConfigOverviewData,
    LocaleConfigWidgetData
  >({
    endpoint: '/dashboard-core/config/overview',
    queryKey: 'dashboard-core-config-overview',
    select: (d) => d.localeConfig,
  });

  const localeData = data ?? defaultLocaleConfigData;
  const enabledLocales = localeData.locales.filter((locale) => locale.enabled);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? t('title')}
      onRemove={onRemove}
    >
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                <Globe className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                localeData.status.isConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            >
              {localeData.status.isConfigured ? t('configured') : t('pending')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('enabled')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {localeData.status.enabledLocaleCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('disabled')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {localeData.status.disabledLocaleCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{t('total')}</p>
              <p className="mt-1 text-lg font-semibold">
                {localeData.locales.length}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t('timezone')}
              </div>
              <p className="truncate font-mono text-xs">
                {localeData.settings.timezone || t('notSet')}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {t('dateFormat')}
              </div>
              <p className="font-mono text-xs">
                {localeData.settings.dateFormat || t('notSet')}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t('timeFormat')}
              </div>
              <p className="font-mono text-xs">
                {localeData.settings.timeFormat || t('notSet')}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Languages className="h-3.5 w-3.5" />
              <span>{t('enabledLocales')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledLocales.length > 0 ? (
                enabledLocales.map((locale) => (
                  <Badge key={locale.id} variant="outline" className="gap-1">
                    <span className="font-mono text-[10px]">{locale.code}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {locale.name}
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t('noneEnabled')}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

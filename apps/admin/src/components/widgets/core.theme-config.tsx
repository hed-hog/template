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
  ThemeConfigWidgetData,
} from '@/types/widget-data';
import { Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const emptyPaletteMode = {
  primary: null,
  primaryForeground: null,
  secondary: null,
  secondaryForeground: null,
  accent: null,
  accentForeground: null,
  muted: null,
  mutedForeground: null,
  background: null,
  backgroundForeground: null,
  card: null,
  cardForeground: null,
};

const defaultThemeConfigData: ThemeConfigWidgetData = {
  status: {
    isConfigured: false,
    configuredTokenCount: 0,
  },
  branding: {
    systemName: null,
    systemSlogan: null,
    iconUrl: null,
    imageUrl: null,
  },
  presentation: {
    mode: null,
    font: null,
    textSize: null,
    radius: null,
  },
  palette: {
    light: emptyPaletteMode,
    dark: emptyPaletteMode,
  },
};

interface ThemeConfigProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function ThemeConfig({ widget, onRemove }: ThemeConfigProps) {
  const t = useTranslations('core.DashboardPage.themeConfig');

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    DashboardCoreConfigOverviewData,
    ThemeConfigWidgetData
  >({
    endpoint: '/dashboard-core/config/overview',
    queryKey: 'dashboard-core-config-overview',
    select: (d) => d.themeConfig,
  });

  const themeData = data ?? defaultThemeConfigData;

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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">
                <Palette className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                themeData.status.isConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            >
              {themeData.status.isConfigured ? t('configured') : t('pending')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{
                  backgroundColor: themeData.palette.light.primary || '#64748b',
                }}
              >
                {(themeData.branding.systemName || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {themeData.branding.systemName || t('notSet')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {themeData.branding.systemSlogan || t('notSet')}
                </p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {themeData.presentation.mode || t('notSet')}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{t('tokens')}</p>
              <p className="mt-1 text-lg font-semibold">
                {themeData.status.configuredTokenCount}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{t('font')}</p>
              <p className="mt-1 truncate text-sm font-medium">
                {themeData.presentation.font || t('notSet')}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('textSize')}
              </p>
              <p className="mt-1 truncate text-sm font-medium">
                {themeData.presentation.textSize || t('notSet')}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{t('radius')}</p>
              <p className="mt-1 truncate text-sm font-medium">
                {themeData.presentation.radius || t('notSet')}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('lightPalette')}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {themeData.palette.light.primary || t('notSet')}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded-full border"
                  style={{
                    backgroundColor:
                      themeData.palette.light.primary || 'transparent',
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {t('primary')}
                </span>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('darkPalette')}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {themeData.palette.dark.primary || t('notSet')}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded-full border"
                  style={{
                    backgroundColor:
                      themeData.palette.dark.primary || 'transparent',
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {t('primary')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

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
  OAuthConfigWidgetData,
} from '@/types/widget-data';
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const defaultOAuthConfigData: OAuthConfigWidgetData = {
  status: {
    isConfigured: false,
    enabledProviderCount: 0,
    configuredProviderCount: 0,
    connectedAccountCount: 0,
  },
  providers: [],
};

interface OAuthConfigProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function OAuthConfig({ widget, onRemove }: OAuthConfigProps) {
  const t = useTranslations('core.DashboardPage.oauthConfig');

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    DashboardCoreConfigOverviewData,
    OAuthConfigWidgetData
  >({
    endpoint: '/dashboard-core/config/overview',
    queryKey: 'dashboard-core-config-overview',
    select: (d) => d.oauthConfig,
  });

  const oauthData = data ?? defaultOAuthConfigData;

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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <KeyRound className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                oauthData.status.isConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            >
              {oauthData.status.isConfigured ? t('configured') : t('pending')}
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
                {oauthData.status.enabledProviderCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('configuredProviders')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {oauthData.status.configuredProviderCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('connectedAccounts')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {oauthData.status.connectedAccountCount}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {oauthData.providers.length > 0 ? (
              oauthData.providers.map((provider) => (
                <div key={provider.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{provider.label}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={
                          provider.enabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {provider.enabled ? (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {t('enabled')}
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-1 h-3 w-3" />
                            {t('disabled')}
                          </>
                        )}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          provider.configured
                            ? 'border-emerald-200 text-emerald-700'
                            : 'text-muted-foreground'
                        }
                      >
                        {provider.configured ? t('configured') : t('pending')}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span>
                      {t('scopesCount', { count: provider.scopesCount })}
                    </span>
                    <span>
                      {t('connectedUsers', { count: provider.connectedUsers })}
                    </span>
                    <span>
                      {provider.missingKeys.length > 0
                        ? t('missingKeys', {
                            count: provider.missingKeys.length,
                          })
                        : t('allKeysPresent')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('noProviders')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

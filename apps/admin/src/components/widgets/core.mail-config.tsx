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
  MailConfigWidgetData,
} from '@/types/widget-data';
import { CheckCircle2, Mail, Send, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const defaultMailConfigData: MailConfigWidgetData = {
  status: {
    isConfigured: false,
    selectedProvider: null,
    configuredProvider: null,
  },
  sender: {
    from: null,
  },
  metrics: {
    templateCount: 0,
    sentCount: 0,
    sentLast30Days: 0,
  },
  providers: [],
};

interface MailConfigProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

const iconByProvider: Record<string, React.ElementType> = {
  SMTP: Server,
  GMAIL: Mail,
  SES: Send,
};

export default function MailConfig({ widget, onRemove }: MailConfigProps) {
  const t = useTranslations('core.DashboardPage.mailConfig');

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    DashboardCoreConfigOverviewData,
    MailConfigWidgetData
  >({
    endpoint: '/dashboard-core/config/overview',
    queryKey: 'dashboard-core-config-overview',
    select: (d) => d.mailConfig,
  });

  const mailData = data ?? defaultMailConfigData;

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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                mailData.status.isConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            >
              {mailData.status.isConfigured ? t('configured') : t('pending')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('templates')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {mailData.metrics.templateCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('sentTotal')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {mailData.metrics.sentCount}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('sent30Days')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {mailData.metrics.sentLast30Days}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs text-muted-foreground">{t('sender')}</p>
            <p className="truncate text-sm font-medium">
              {mailData.sender.from || t('notSet')}
            </p>
          </div>

          <div className="min-h-0 flex-1 rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t('providers')}</p>
              <Badge variant="outline" className="text-[10px]">
                {t('selectedProvider', {
                  provider: mailData.status.selectedProvider || t('none'),
                })}
              </Badge>
            </div>
            <div className="space-y-2">
              {mailData.providers.length > 0 ? (
                mailData.providers.map((provider) => {
                  const Icon = iconByProvider[provider.id] ?? Mail;
                  const statusClass = provider.configured
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-muted text-muted-foreground';

                  return (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/60">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {provider.label}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {provider.missingKeys.length > 0
                              ? t('missingKeys', {
                                  count: provider.missingKeys.length,
                                })
                              : t('allKeysPresent')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {provider.selected && (
                          <Badge variant="outline" className="text-[10px]">
                            {t('selected')}
                          </Badge>
                        )}
                        <Badge variant="secondary" className={statusClass}>
                          {provider.configured ? (
                            <>
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t('configured')}
                            </>
                          ) : (
                            t('pending')
                          )}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('noProviders')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

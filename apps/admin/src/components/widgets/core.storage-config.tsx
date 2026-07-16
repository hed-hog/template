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
  StorageConfigWidgetData,
} from '@/types/widget-data';
import { CheckCircle2, HardDrive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const defaultStorageConfigData: StorageConfigWidgetData = {
  status: {
    isConfigured: false,
    totalProfiles: 0,
    activeProfiles: 0,
    defaultProfileId: null,
  },
  providers: [],
  profiles: [],
};

interface StorageConfigProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function StorageConfig({
  widget,
  onRemove,
}: StorageConfigProps) {
  const t = useTranslations('core.DashboardPage.storageConfig');

  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    DashboardCoreConfigOverviewData,
    StorageConfigWidgetData
  >({
    endpoint: '/dashboard-core/config/overview',
    queryKey: 'dashboard-core-config-overview',
    select: (d) => d.storageConfig,
  });

  const storageData = data ?? defaultStorageConfigData;
  const defaultProfile = storageData.profiles.find(
    (profile) => profile.id === storageData.status.defaultProfileId
  );

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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <HardDrive className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                storageData.status.isConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            >
              {storageData.status.isConfigured ? t('configured') : t('pending')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('profiles')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {storageData.status.totalProfiles}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{t('active')}</p>
              <p className="mt-1 text-lg font-semibold">
                {storageData.status.activeProfiles}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t('providers')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {storageData.providers.length}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {t('defaultProfile')}
            </p>
            <p className="truncate text-sm font-medium">
              {defaultProfile?.name || t('notSet')}
            </p>
            {defaultProfile && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {defaultProfile.providerType.toUpperCase()} |{' '}
                {defaultProfile.bucketName}
              </p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {storageData.providers.map((provider) => (
              <div
                key={provider.providerType}
                className="rounded-lg border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {provider.providerType.toUpperCase()}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {provider.defaults} {t('defaults')}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('providerSummary', {
                    total: provider.total,
                    active: provider.active,
                  })}
                </p>
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {storageData.profiles.slice(0, 4).map((profile) => (
              <div key={profile.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <div className="flex items-center gap-1.5">
                    {profile.isDefault && (
                      <Badge variant="outline" className="text-[10px]">
                        {t('defaultTag')}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        profile.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {profile.isActive ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t('active')}
                        </>
                      ) : (
                        t('inactive')
                      )}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {profile.providerType.toUpperCase()} | {profile.bucketName}
                </p>
              </div>
            ))}
            {storageData.profiles.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('noProfiles')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

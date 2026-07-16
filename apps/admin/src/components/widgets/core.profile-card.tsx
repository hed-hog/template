'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useWidgetData } from '@/hooks/use-widget-data';
import { formatDateTime } from '@/lib/format-date';
import { getPhotoUrl } from '@/lib/get-photo-url';
import type { AllWidgetsData, ProfileData } from '@/types/widget-data';
import { useApp } from '@hed-hog/next-app-provider';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Globe,
  Mail,
  Shield,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

function ProfileContent({ profile }: { profile: ProfileData }) {
  const { getSettingValue } = useApp();
  const router = useRouter();
  const t = useTranslations('core.DashboardPage.profileCard');

  return (
    <Card className="relative flex h-full flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-br from-muted to-muted/50" />
      <CardContent className="relative flex flex-1 flex-col overflow-hidden pt-7 pb-12">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <div className="relative">
            <Avatar className="h-20 w-20 border-4 border-card shadow-md">
              {profile.photo_id && (
                <AvatarImage
                  src={getPhotoUrl(profile.photo_id)}
                  alt={profile.name}
                />
              )}
              <AvatarFallback className="bg-foreground text-background text-xl font-bold">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-card bg-emerald-500" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {profile.name}
              </h2>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground">{profile.role}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                {t('online')}
              </Badge>
            </div>
          </div>
          <Button
            onClick={() => router.push('/core/account/profile')}
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {t('editProfile')}
          </Button>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                {t('email')}
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {profile.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                {t('memberSinceLabel')}
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {formatDateTime(profile.memberSince, getSettingValue)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
              <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                {t('activeSessions')}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {profile.totalSessions}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                {t('roles')}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {profile.totalRoles}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 border-t bg-card px-4 py-2">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">
          {t('lastLogin', {
            date: formatDateTime(profile.lastLogin, getSettingValue),
          })}
        </span>
      </div>
    </Card>
  );
}

interface ProfileCardProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function ProfileCard({ widget, onRemove }: ProfileCardProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    ProfileData
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.profile,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'profile-card'}
      onRemove={onRemove}
    >
      {data && <ProfileContent profile={data} />}
    </WidgetWrapper>
  );
}

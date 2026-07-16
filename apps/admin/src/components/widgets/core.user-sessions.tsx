'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWidgetData } from '@/hooks/use-widget-data';
import type { AllWidgetsData, SessionData } from '@/types/widget-data';
import {
  Clock,
  Globe,
  Info,
  LogOut,
  Monitor,
  MoreHorizontal,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  const u = ua.toLowerCase();
  if (u.includes('ipad') || u.includes('tablet')) return 'tablet';
  if (u.includes('mobile') || u.includes('iphone') || u.includes('android'))
    return 'mobile';
  return 'desktop';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua)) return 'Safari';
  if (/msie|trident/i.test(ua)) return 'IE';
  return 'Browser';
}

function detectDevice(ua: string): string {
  if (/ipad/i.test(ua)) return 'iPad';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/android/i.test(ua)) return 'Android';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Dispositivo';
}

function formatRelative(
  dateStr: string,
  tActiveNow: string,
  tMinsAgo: (n: number) => string,
  tHoursAgo: (n: number) => string,
  tDaysAgo: (n: number) => string
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tActiveNow;
  if (mins < 60) return tMinsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tHoursAgo(hours);
  const days = Math.floor(hours / 24);
  return tDaysAgo(days);
}

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

function SessionsContent({ sessions }: { sessions: SessionData[] }) {
  const t = useTranslations('core.DashboardPage.userSessions');
  const router = useRouter();

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold sm:text-base">
                {t('title')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('description')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/core/account/sessions')}
            className="h-8 w-full shrink-0 gap-1.5 px-2.5 text-xs sm:h-9 sm:w-auto sm:text-sm"
          >
            <Info className="h-3.5 w-3.5" />
            {t('moreInfo')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 overflow-auto pt-0">
        <div className="grid w-full items-start grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 sm:gap-3">
          {sessions.map((session, index) => {
            const ua = session.user_agent ?? '';
            const deviceType = detectDeviceType(ua);
            const browser = detectBrowser(ua);
            const device = detectDevice(ua);
            const isCurrent = index === 0;
            const DeviceIcon = deviceIcons[deviceType];
            const ip = session.ip_address
              ? session.ip_address.replace(/(\d+\.\d+\.\d+\.)\d+/, '$1***')
              : '—';
            const relativeTime = formatRelative(
              session.created_at,
              t('activeNow'),
              (n) => t('minutesAgo', { count: n }),
              (n) => t('hoursAgo', { count: n }),
              (n) =>
                n === 1
                  ? t('daysAgo', { count: n })
                  : t('daysAgoPlural', { count: n })
            );

            return (
              <div
                key={session.id}
                className={`group flex items-center gap-2.5 rounded-xl border p-3 transition-all duration-200 hover:shadow-sm sm:gap-3 sm:p-3.5 ${
                  isCurrent
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'bg-card hover:bg-muted/30'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
                    isCurrent
                      ? 'bg-emerald-100 dark:bg-emerald-900/50'
                      : 'bg-muted'
                  }`}
                >
                  <DeviceIcon
                    className={`h-4 w-4 sm:h-5 sm:w-5 ${
                      isCurrent
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 wrap-break-word text-[13px] font-medium text-foreground sm:text-sm">
                      {device}
                    </span>
                    {isCurrent && (
                      <Badge className="bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                        {t('thisSession')}
                      </Badge>
                    )}
                  </div>
                  <span className="wrap-break-word text-[11px] text-muted-foreground sm:text-xs">
                    {browser} &middot; {ip}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/70 sm:gap-3 sm:text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime}
                    </span>
                  </div>
                </div>
                {!isCurrent && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        {t('terminateSession')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface UserSessionsProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function UserSessions({ widget, onRemove }: UserSessionsProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    SessionData[]
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.userSessions,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'user-sessions'}
      onRemove={onRemove}
    >
      {data && <SessionsContent sessions={data} />}
    </WidgetWrapper>
  );
}

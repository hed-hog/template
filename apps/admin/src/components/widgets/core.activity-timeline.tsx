'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWidgetData } from '@/hooks/use-widget-data';
import type { ActivityEvent, AllWidgetsData } from '@/types/widget-data';
import {
  FileEdit,
  LogIn,
  LogOut,
  Mail,
  Settings,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const typeIconMap: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogOut,
  security: ShieldAlert,
  settings: Settings,
  edit: FileEdit,
  permission: UserCheck,
  email: Mail,
};

const typeColorMap: Record<string, { color: string; bg: string }> = {
  login: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  logout: { color: 'text-muted-foreground', bg: 'bg-muted' },
  security: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  settings: { color: 'text-foreground', bg: 'bg-muted' },
  edit: {
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
  },
  permission: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  email: {
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
  },
};

function detectType(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('login') || a.includes('entrou') || a.includes('acesso'))
    return 'login';
  if (a.includes('logout') || a.includes('saiu') || a.includes('encerr'))
    return 'logout';
  if (
    a.includes('senha') ||
    a.includes('2fa') ||
    a.includes('mfa') ||
    a.includes('segur')
  )
    return 'security';
  if (a.includes('config') || a.includes('idioma') || a.includes('preferên'))
    return 'settings';
  if (
    a.includes('edit') ||
    a.includes('atualiz') ||
    a.includes('alter') ||
    a.includes('perfil')
  )
    return 'edit';
  if (a.includes('permiss') || a.includes('acesso') || a.includes('role'))
    return 'permission';
  if (a.includes('email') || a.includes('e-mail') || a.includes('notif'))
    return 'email';
  return 'settings';
}

function formatDate(
  dateStr: string,
  tToday: string,
  tYesterday: string
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const eventDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  if (eventDay.getTime() === today.getTime()) return tToday;
  if (eventDay.getTime() === yesterday.getTime()) return tYesterday;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelineContent({ events }: { events: ActivityEvent[] }) {
  const t = useTranslations('core.DashboardPage.activityTimeline');
  let lastDate = '';

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold sm:text-base">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('description')}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {t('events', { count: events.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
        <ScrollArea className="h-full pr-2 sm:pr-3">
          <div className="relative flex flex-col pb-2">
            <div className="absolute bottom-0 left-[13px] top-0 w-px bg-border/60 sm:left-[15px]" />
            {events.map((event, index) => {
              const type = detectType(event.action);
              const config =
                typeColorMap[type] ??
                (typeColorMap.settings as { color: string; bg: string });
              const Icon = (typeIconMap[type] ?? Settings) as React.ElementType;
              const dateLabel = formatDate(
                event.created_at,
                t('today'),
                t('yesterday')
              );
              const showDate = dateLabel !== lastDate;
              lastDate = dateLabel;

              return (
                <div key={event.id}>
                  {showDate && (
                    <div className="relative z-10 mb-1 mt-4 first:mt-0">
                      <span className="ml-9 inline-block rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:ml-11 sm:px-2 sm:text-[11px]">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <div className="group relative flex items-start gap-3 py-1.5">
                    <div
                      className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${config.bg}`}
                    >
                      <Icon
                        className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${config.color}`}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-1.5 py-1.5 transition-colors group-hover:bg-muted/40 sm:px-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 wrap-break-word text-xs font-medium leading-snug text-foreground sm:text-sm">
                          {event.action}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface ActivityTimelineProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function ActivityTimeline({
  widget,
  onRemove,
}: ActivityTimelineProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    ActivityEvent[]
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.activityTimeline,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'activity-timeline'}
      onRemove={onRemove}
    >
      {data && <TimelineContent events={data} />}
    </WidgetWrapper>
  );
}

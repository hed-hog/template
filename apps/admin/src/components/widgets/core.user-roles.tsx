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
import type { AllWidgetsData, RoleData } from '@/types/widget-data';
import { Crown, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const levelStyles = [
  {
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50/50 dark:bg-blue-950/30',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  },
  {
    border: 'border-indigo-200 dark:border-indigo-800',
    bg: 'bg-indigo-50/30 dark:bg-indigo-950/20',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    badge:
      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  },
  {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50/30 dark:bg-emerald-950/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50/30 dark:bg-amber-950/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
];

function RolesContent({ roles }: { roles: RoleData[] }) {
  const t = useTranslations('core.DashboardPage.userRoles');

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div>
            <CardTitle className="text-sm font-semibold">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs leading-tight">
              {t('description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 overflow-auto pt-0">
        <div className="grid content-start items-start grid-cols-1 gap-1.5 md:grid-cols-2">
          {roles.map((role, index) => {
            const style = levelStyles[index % levelStyles.length]!;
            return (
              <div
                key={role.id}
                className={`flex h-fit self-start items-center gap-2 rounded-lg border p-2 transition-all duration-200 hover:shadow-sm ${style.border} ${style.bg}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${style.iconBg}`}
                >
                  <ShieldCheck className={`h-3.5 w-3.5 ${style.iconColor}`} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium text-foreground sm:text-[13px]">
                    {role.name}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                    {role.slug}
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 px-1.5 py-0 text-[10px] ${style.badge}`}
                >
                  {t('active')}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface UserRolesProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function UserRoles({ widget, onRemove }: UserRolesProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    RoleData[]
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.userRoles,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'user-roles'}
      onRemove={onRemove}
    >
      {data && <RolesContent roles={data} />}
    </WidgetWrapper>
  );
}

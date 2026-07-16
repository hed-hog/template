'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useWidgetData } from '@/hooks/use-widget-data';
import type { AllWidgetsData } from '@/types/widget-data';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { AccountSecurityData } from '@/types/widget-data';
import { useRouter } from 'next/navigation';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

const ICON_MAP: Record<string, React.ElementType> = {
  password: Lock,
  '2fa': Smartphone,
  email: Mail,
  sessions: AlertTriangle,
};

const CHECK_ROUTE_MAP: Record<string, string> = {
  password: '/core/account/password',
  '2fa': '/core/account/2fa',
  email: '/core/account/email',
  sessions: '/core/account/sessions',
};

function AccountSecurityContent({ data }: { data: AccountSecurityData }) {
  const t = useTranslations('core.DashboardPage.accountSecurity');
  const router = useRouter();
  const [score, setScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setScore(data.score), 300);
    return () => clearTimeout(timer);
  }, [data.score]);

  const scoreColor =
    score >= 80
      ? 'text-emerald-600'
      : score >= 50
        ? 'text-amber-600'
        : 'text-red-600';

  const progressColor =
    score >= 80
      ? 'hsl(160, 84%, 39%)'
      : score >= 50
        ? 'hsl(38, 92%, 50%)'
        : 'hsl(0, 84%, 60%)';

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 px-4 pb-2 pt-4 sm:px-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <CardTitle className="text-base font-semibold">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-3 pt-0 sm:px-5 sm:pb-4">
        <div className="mb-2 flex flex-col items-center gap-1.5 rounded-xl bg-muted/50 p-2 sm:mb-3 sm:gap-2 sm:p-3">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${scoreColor}`}
            >
              {score}
            </span>
            <span className="text-xs text-muted-foreground sm:text-sm">
              /100
            </span>
          </div>
          <Progress
            value={score}
            className="h-1.5 w-full max-w-70"
            style={
              {
                '--progress-foreground': progressColor,
              } as any
            }
          />
          <p className="text-[10px] text-muted-foreground sm:text-[11px]">
            {score >= 80 ? t('wellProtected') : t('recommendProtections')}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {data.checks.map((item) => {
            const Icon = ICON_MAP[item.id] ?? ShieldCheck;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() =>
                  router.push(CHECK_ROUTE_MAP[item.id] ?? '/core/account')
                }
                className="group flex w-full cursor-pointer flex-wrap items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:items-center sm:gap-2.5 sm:p-2.5"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${
                    item.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/40'
                      : 'bg-muted'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      item.enabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="wrap-break-word text-[12px] font-medium text-foreground sm:text-[13px]">
                      {t(`labels.${item.labelKey}` as any) || item.labelKey}
                    </span>
                    {item.enabled ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                    {t(`descriptions.${item.descriptionKey}` as any) ||
                      item.descriptionKey}
                  </span>
                </div>
                <div className="mt-0.5 flex w-full shrink-0 items-center justify-end gap-1 text-[11px] font-medium text-foreground sm:mt-0 sm:w-auto sm:text-xs">
                  {!item.enabled && <span>{t('activate')}</span>}
                  <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface AccountSecurityProps {
  widget?: { name?: string };
  onRemove?: () => void;
}

export default function AccountSecurity({
  widget,
  onRemove,
}: AccountSecurityProps) {
  const { data, isLoading, isError, isAccessDenied } = useWidgetData<
    AllWidgetsData,
    AccountSecurityData
  >({
    endpoint: '/dashboard-core/widgets/me',
    queryKey: 'widget-me',
    select: (d) => d.accountSecurity,
  });

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isError={isError}
      isAccessDenied={isAccessDenied}
      widgetName={widget?.name ?? 'account-security'}
      onRemove={onRemove}
    >
      {data && <AccountSecurityContent data={data} />}
    </WidgetWrapper>
  );
}

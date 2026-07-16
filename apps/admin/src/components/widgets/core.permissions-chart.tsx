'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { IconGripVertical } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  const t = useTranslations('core.Dashboard');
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: entry?.payload.color }}
        />
        {entry?.name}: {entry?.value} {t('permissionsLowercase')}
      </p>
    </div>
  );
}

interface PermissionsChartProps {
  widget?: {
    name?: string;
  } | null;
  onRemove?: () => void;
}

interface PermissionDistributionItem {
  name: string;
  value: number;
  color: string;
}

interface UserStatsData {
  charts?: {
    permissionDistribution?: PermissionDistributionItem[];
  };
}

export default function PermissionsChart({
  widget,
  onRemove,
}: PermissionsChartProps) {
  const t = useTranslations('core.Dashboard');

  const {
    data: statsData,
    isLoading,
    isAccessDenied,
    isError,
  } = useWidgetData<UserStatsData>({
    endpoint: '/dashboard-core/stats/overview/users',
    queryKey: 'dashboard-stats-users',
  });

  const data = statsData?.charts?.permissionDistribution || [];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={widget?.name || t('permissionsDistributionTitle')}
      onRemove={onRemove}
    >
      <Card className="h-full flex flex-col group">
        <div
          className="drag-handle absolute top-3 left-4 z-10"
          style={{ cursor: 'grab' }}
        >
          <IconGripVertical className="text-muted-foreground/50 size-4 shrink-0" />
        </div>
        <CardHeader className="pb-2 pt-4 pl-10">
          <CardTitle className="text-base font-semibold">
            {t('permissionsDistributionTitle')}
          </CardTitle>
          <CardDescription>
            {t('permissionsDistributionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="flex h-full items-center justify-between gap-4 overflow-hidden">
            <div className="relative h-[280px] w-[280px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                  dataKey="value"
                  animationDuration={1200}
                  strokeWidth={0}
                >
                    {data.map((entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">
                  {total}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t('total')}
                </span>
              </div>
            </div>
            <div className="grid max-h-[280px] min-w-0 flex-1 grid-cols-2 content-start gap-x-4 gap-y-2 overflow-y-auto pr-2">
              {data.map((item) => (
                <div key={item.name} className="flex min-w-0 items-start gap-2.5">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words text-xs font-medium leading-tight text-foreground">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.value} ({total ? Math.round((item.value / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

'use client';

import { WidgetWrapper } from '@/app/(app)/(libraries)/core/dashboard/components';
import { useOperationsTaskRealtimeRefresh } from '@/app/(app)/(libraries)/operations/_lib/hooks/use-operations-task-realtime-refresh';
import CapacityDistribution from '@/app/(app)/(libraries)/operations/dashboard/widgets/CapacityDistribution';
import { Card, CardContent } from '@/components/ui/card';
import { useWidgetData } from '@/hooks/use-widget-data';
import { useApp } from '@hed-hog/next-app-provider';
import { useQueryClient } from '@tanstack/react-query';

interface WidgetLayoutLike {
  name?: string;
  slug?: string;
}

interface OperationsWidgetProps {
  widget?: WidgetLayoutLike;
  onRemove?: () => void;
}

interface OperationsDashboardData {
  actor: {
    roleScope: 'self' | 'team' | 'full';
    collaboratorId: number | null;
    collaboratorName: string | null;
    teamSize: number;
  };
  cards: {
    projectsTotal: number;
    activeProjects: number;
    visibleTimesheets: number;
    pendingTimesheets: number;
    timeOffRequests: number;
    scheduleAdjustmentRequests: number;
    pendingApprovals: number;
  };
  recentTimesheets: Array<{
    id: number;
    collaboratorName: string;
    weekStartDate: string;
    weekEndDate: string;
    totalHours: number | null;
    status: string;
  }>;
}

interface SharedOperationsWidgetProps extends OperationsWidgetProps {
  slug: string;
}

const buildSummary = (slug: string, data: OperationsDashboardData | undefined) => {
  const cards = data?.cards;
  const actor = data?.actor;

  const fallback = {
    value: 0,
    caption: 'Sem dados disponiveis',
    detail: 'Aguardando sincronizacao com o dashboard.',
  };

  if (!cards || !actor) {
    return fallback;
  }

  const map: Record<string, { value: number; caption: string; detail: string }> = {
    'my-hours-period-kpi': {
      value: cards.visibleTimesheets,
      caption: 'Lacamentos visiveis',
      detail: `Timesheets pendentes: ${cards.pendingTimesheets}`,
    },
    'my-timesheet-status-kpi': {
      value: cards.pendingTimesheets,
      caption: 'Timesheets pendentes',
      detail: `Timesheets visiveis: ${cards.visibleTimesheets}`,
    },
    'my-project-allocations-kpi': {
      value: cards.activeProjects,
      caption: 'Projetos ativos',
      detail: `Projetos visiveis: ${cards.projectsTotal}`,
    },
    'my-open-requests-kpi': {
      value: cards.timeOffRequests + cards.scheduleAdjustmentRequests,
      caption: 'Solicitacoes abertas',
      detail: `Folgas: ${cards.timeOffRequests} · Ajustes: ${cards.scheduleAdjustmentRequests}`,
    },
    'team-headcount-kpi': {
      value: actor.teamSize,
      caption: 'Tamanho da equipe',
      detail: `Escopo atual: ${actor.roleScope}`,
    },
    'team-pending-approvals-kpi': {
      value: cards.pendingApprovals,
      caption: 'Aprovacoes pendentes',
      detail: `Timesheets pendentes: ${cards.pendingTimesheets}`,
    },
    'team-hours-kpi': {
      value: cards.visibleTimesheets,
      caption: 'Horas em timesheets',
      detail: `Escopo atual: ${actor.roleScope}`,
    },
    'team-capacity-kpi': {
      value: actor.teamSize,
      caption: 'Capacidade monitorada',
      detail: `Solicitacoes em aberto: ${cards.timeOffRequests + cards.scheduleAdjustmentRequests}`,
    },
    'portfolio-projects-kpi': {
      value: cards.projectsTotal,
      caption: 'Projetos do portfolio',
      detail: `Projetos ativos: ${cards.activeProjects}`,
    },
    'portfolio-costs-kpi': {
      value: cards.pendingApprovals,
      caption: 'Itens aguardando aprovacao',
      detail: 'Use este KPI para identificar impacto operacional imediato.',
    },
    'portfolio-effort-kpi': {
      value: cards.visibleTimesheets,
      caption: 'Esforco registrado',
      detail: `Timesheets pendentes: ${cards.pendingTimesheets}`,
    },
    'portfolio-risk-kpi': {
      value: cards.pendingApprovals,
      caption: 'Risco operacional',
      detail: 'Pendencias de aprovacao podem indicar gargalos.',
    },
  };

  if (map[slug]) {
    return map[slug];
  }

  return {
    value: data.recentTimesheets.length,
    caption: 'Atualizacoes recentes',
    detail: `Escopo ${actor.roleScope} · ${data.recentTimesheets.length} registros recentes`,
  };
};

const CAPACITY_ICONS = ['📦', '👥', '🔧', '💻', '📊', '🎯'];

function buildCapacityData(data: OperationsDashboardData) {
  const composition = (data as any).directorPortfolioFinancial?.costComposition ?? [];
  const total = composition.reduce((sum: number, item: any) => sum + item.value, 0);
  return {
    areas: composition.map((item: any, idx: number) => ({
      name: item.name,
      capacity: item.value,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
      color: '',
      icon: CAPACITY_ICONS[idx % CAPACITY_ICONS.length] ?? '📦',
    })),
    totalCapacity: total,
  };
}

export default function SharedOperationsWidget({
  widget,
  onRemove,
  slug,
}: SharedOperationsWidgetProps) {
  const { request } = useApp();
  const queryClient = useQueryClient();

  const { data, isLoading, isAccessDenied, isError } =
    useWidgetData<OperationsDashboardData>({
      endpoint: '/operations/dashboard',
      queryKey: 'operations-dashboard-shared-v2',
    });

  useOperationsTaskRealtimeRefresh({
    request,
    onRefresh: () =>
      queryClient.invalidateQueries({
        queryKey: ['operations-dashboard-shared-v2'],
      }),
  });

  const title = widget?.name || slug;

  if (slug === 'capacity-distribution') {
    return (
      <WidgetWrapper
        isLoading={isLoading}
        isAccessDenied={isAccessDenied}
        isError={isError}
        widgetName={title}
        onRemove={onRemove}
      >
        <CapacityDistribution
          slug={slug}
          title={title}
          roleSlug="director"
          data={data ? buildCapacityData(data) : undefined}
        />
      </WidgetWrapper>
    );
  }

  const summary = buildSummary(slug, data);

  return (
    <WidgetWrapper
      isLoading={isLoading}
      isAccessDenied={isAccessDenied}
      isError={isError}
      widgetName={title}
      onRemove={onRemove}
    >
      <Card className="h-full border-border/60 bg-linear-to-br from-background to-slate-50/40 shadow-sm">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {summary.caption}
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">{summary.value}</p>
          </div>
          <p className="text-xs text-muted-foreground">{summary.detail}</p>
        </CardContent>
      </Card>
    </WidgetWrapper>
  );
}

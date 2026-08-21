import { toPascalCase } from '../naming';
import type { ScaffoldPlan } from '../types';
import { entityNames, scalarColumns, type TemplateOutput } from './shared';

/** Painel: KPIs vindos de `GET <api>/stats` e área de widgets para preencher. */
function buildPage(plan: ScaffoldPlan): string {
  const names = entityNames(plan);
  const enumColumn = scalarColumns(plan).find((column) => column.type === 'enum');

  const statsCards = [
    '    {',
    "      key: 'total',",
    "      title: t('statsTotal'),",
    '      value: stats.total ?? 0,',
    '      icon: Layers,',
    "      accentClassName: 'from-slate-500/20 via-slate-400/10 to-transparent',",
    "      iconContainerClassName: 'bg-slate-100 text-slate-700',",
    '    },',
    ...(enumColumn?.enumValues ?? []).map((value) =>
      [
        '    {',
        `      key: '${value}',`,
        `      title: t('stats${toPascalCase(value)}'),`,
        `      value: stats.${value} ?? 0,`,
        '      icon: Layers,',
        "      accentClassName: 'from-blue-500/20 via-cyan-500/10 to-transparent',",
        "      iconContainerClassName: 'bg-blue-50 text-blue-600',",
        '    },',
      ].join('\n')
    ),
  ].join('\n');

  return [
    "'use client';",
    '',
    "import { Page, PageHeader } from '@/components/entity-list';",
    "import { Card, CardContent } from '@/components/ui/card';",
    "import { KpiCardsGrid } from '@/components/ui/kpi-cards-grid';",
    "import { useApp, useQuery } from '@hed-hog/next-app-provider';",
    "import { Layers } from 'lucide-react';",
    "import { useTranslations } from 'next-intl';",
    '',
    `export default function ${names.pageComponent}() {`,
    `  const t = useTranslations('${plan.library}.${names.pascal}Page');`,
    '  const { request } = useApp();',
    '',
    '  const { data: stats = {} } = useQuery<Record<string, number>>({',
    `    queryKey: ['${plan.library}-${names.kebab}-dashboard-stats'],`,
    '    queryFn: async () => {',
    '      const response = await request<Record<string, number>>({',
    `        url: '${plan.apiBasePath}/stats',`,
    "        method: 'GET',",
    '      });',
    '',
    '      return response.data;',
    '    },',
    '    placeholderData: (previous) => previous ?? {},',
    '  });',
    '',
    '  const statsCards = [',
    statsCards,
    '  ];',
    '',
    '  return (',
    '    <Page>',
    '      <PageHeader',
    '        breadcrumbs={[',
    "          { label: t('breadcrumbHome'), href: '/' },",
    "          { label: t('title') },",
    '        ]}',
    "        title={t('title')}",
    "        description={t('description')}",
    '      />',
    '',
    '      <KpiCardsGrid items={statsCards} />',
    '',
    '      <Card className="border-border/70">',
    '        <CardContent className="p-6 text-sm text-muted-foreground">',
    "          {t('emptyStateDescription')}",
    '        </CardContent>',
    '      </Card>',
    '    </Page>',
    '  );',
    '}',
    '',
  ].join('\n');
}

export function renderDashboardTemplate(plan: ScaffoldPlan): TemplateOutput {
  return {
    page: buildPage(plan),
    components: [],
  };
}

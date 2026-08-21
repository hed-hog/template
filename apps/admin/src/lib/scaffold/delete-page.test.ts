import type { PageManifestEntry } from '@/lib/pages-manifest';
import { describe, expect, it } from 'vitest';
import { buildDeletionPlan, DeletePageError } from './delete-page';
import { createMemoryFs } from './scaffold-fixtures';

function makePage(overrides: Partial<PageManifestEntry> = {}): PageManifestEntry {
  return {
    route: '/crm/service-orders',
    library: 'crm',
    segments: ['crm', 'service-orders'],
    file: 'apps/admin/src/app/(app)/(libraries)/crm/service-orders/page.tsx',
    directory: 'apps/admin/src/app/(app)/(libraries)/crm/service-orders',
    components: [],
    loc: 120,
    i18nNamespaces: ['crm.ServiceOrderPage', 'crm.CrmMenu'],
    endpoints: [],
    features: {
      pageHeader: true,
      kpis: true,
      searchBar: true,
      pagination: true,
      viewModeToggle: true,
      formSheet: true,
      dataTable: true,
      widgets: false,
    },
    referencedBy: [],
    hasChildren: false,
    ...overrides,
  };
}

const TS = '20260722180000';

describe('buildDeletionPlan', () => {
  it('lança erro quando a rota não existe', () => {
    const fs = createMemoryFs({});

    expect(() =>
      buildDeletionPlan({ route: '/nope' }, [makePage()], fs, TS)
    ).toThrow(DeletePageError);
  });

  it('sem subrotas, apaga o diretório inteiro', () => {
    const page = makePage();
    const fs = createMemoryFs({});

    const files = buildDeletionPlan({ route: page.route }, [page], fs, TS);
    const pageEntry = files.find((f) => f.category === 'page');

    expect(pageEntry?.action).toBe('delete');
    expect(pageEntry?.path).toBe(page.directory);
  });

  it('com subrotas, apaga só page.tsx e _components', () => {
    const page = makePage({ hasChildren: true });
    const fs = createMemoryFs({ [`${page.directory}/_components/x.tsx`]: 'x' });

    const files = buildDeletionPlan({ route: page.route }, [page], fs, TS);
    const paths = files.filter((f) => f.category === 'page').map((f) => f.path);

    expect(paths).toContain(page.file);
    expect(paths).toContain(`${page.directory}/_components`);
    expect(paths).not.toContain(page.directory);
  });

  it('inclui o espelho .ejs quando existe', () => {
    const page = makePage();
    const mirrorDir = 'libraries/crm/hedhog/frontend/app/service-orders';
    const fs = createMemoryFs({ [`${mirrorDir}/page.tsx.ejs`]: 'ejs' });

    const files = buildDeletionPlan({ route: page.route }, [page], fs, TS);
    const mirror = files.find((f) => f.category === 'mirror');

    expect(mirror?.path).toBe(mirrorDir);
  });

  it('não inclui espelho quando não existe no disco', () => {
    const files = buildDeletionPlan(
      { route: '/crm/service-orders' },
      [makePage()],
      createMemoryFs({}),
      TS
    );

    expect(files.some((f) => f.category === 'mirror')).toBe(false);
  });

  it('remove namespace i18n exclusivo desta página', () => {
    const page = makePage();
    const fs = createMemoryFs({
      'apps/admin/messages/crm/en.json':
        '{\n  "ServiceOrderPage": { "title": "SO" },\n  "CrmMenu": { "x": "y" }\n}',
      'apps/admin/messages/crm/pt.json':
        '{\n  "ServiceOrderPage": { "title": "OS" }\n}',
    });

    const files = buildDeletionPlan({ route: page.route }, [page], fs, TS);
    const i18n = files.filter((f) => f.category === 'i18n');

    expect(i18n).toHaveLength(2);
    const en = i18n.find((f) => f.path.endsWith('en.json'));
    const parsed = JSON.parse(en!.contents ?? '{}');
    expect(parsed.ServiceOrderPage).toBeUndefined();
    // Namespace compartilhado permanece.
    expect(parsed.CrmMenu).toBeDefined();
  });

  it('não remove namespace usado por outra página', () => {
    const page = makePage();
    const sibling = makePage({
      route: '/crm/other',
      i18nNamespaces: ['crm.ServiceOrderPage'],
    });
    const fs = createMemoryFs({
      'apps/admin/messages/crm/en.json':
        '{\n  "ServiceOrderPage": { "title": "SO" }\n}',
    });

    const files = buildDeletionPlan(
      { route: page.route },
      [page, sibling],
      fs,
      TS
    );

    expect(files.some((f) => f.category === 'i18n')).toBe(false);
  });

  it('remove o bloco do menu e gera a migration quando há menuSlug', () => {
    const page = makePage();
    const fs = createMemoryFs({
      'libraries/crm/hedhog/data/menu.yaml':
        '- url: /crm/service-orders\n  slug: /crm/service-orders\n  order: 5\n',
    });

    const files = buildDeletionPlan(
      { route: page.route, menuSlug: '/crm/service-orders', menuLabelPt: 'OS' },
      [page],
      fs,
      TS
    );

    const menu = files.find((f) => f.category === 'menu');
    const migration = files.find((f) => f.category === 'migration');

    expect(menu?.action).toBe('rewrite');
    expect(menu?.contents).not.toContain('/crm/service-orders');
    expect(migration?.path).toContain('_remove_');
    expect(migration?.contents).toContain('DELETE FROM "menu"');
  });

  it('sem menuSlug, não toca em menu nem gera migration', () => {
    const files = buildDeletionPlan(
      { route: '/crm/service-orders' },
      [makePage()],
      createMemoryFs({}),
      TS
    );

    expect(files.some((f) => f.category === 'menu')).toBe(false);
    expect(files.some((f) => f.category === 'migration')).toBe(false);
  });
});

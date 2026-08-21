import { describe, expect, it } from 'vitest';
import {
  detectTemplate,
  getManifestPages,
  isLikelyResidue,
  listLibraries,
  mirrorPathForPage,
  normalizeRoute,
  type PageManifestEntry,
  type PageManifestFeatures,
} from './pages-manifest';

function features(overrides: Partial<PageManifestFeatures> = {}): PageManifestFeatures {
  return {
    pageHeader: false,
    kpis: false,
    searchBar: false,
    pagination: false,
    viewModeToggle: false,
    formSheet: false,
    dataTable: false,
    widgets: false,
    ...overrides,
  };
}

describe('normalizeRoute', () => {
  it('remove barra final e normaliza caixa', () => {
    expect(normalizeRoute('/CRM/Accounts/')).toBe('/crm/accounts');
  });

  it('reduz parâmetros dinâmicos a :param', () => {
    expect(normalizeRoute('/person/accounts/:accountId')).toBe(
      '/person/accounts/:param'
    );
    expect(normalizeRoute('/person/accounts/:targetAccountId')).toBe(
      normalizeRoute('/person/accounts/:accountId')
    );
  });

  it('preserva a raiz', () => {
    expect(normalizeRoute('/')).toBe('/');
  });
});

describe('detectTemplate', () => {
  it('classifica lista com KPIs', () => {
    expect(
      detectTemplate(features({ searchBar: true, pagination: true, kpis: true }))
    ).toBe('list-kpi');
  });

  it('classifica lista simples', () => {
    expect(detectTemplate(features({ searchBar: true, pagination: true }))).toBe(
      'list-simple'
    );
  });

  it('classifica dashboard por widgets ou KPIs sem busca', () => {
    expect(detectTemplate(features({ widgets: true }))).toBe('dashboard');
    expect(detectTemplate(features({ kpis: true }))).toBe('dashboard');
  });

  it('classifica detalhe/formulário', () => {
    expect(detectTemplate(features({ formSheet: true }))).toBe('detail-form');
    expect(detectTemplate(features({ pageHeader: true }))).toBe('detail-form');
  });

  it('cai para custom quando nada é detectado', () => {
    expect(detectTemplate(features())).toBe('custom');
  });
});

const manifestPages = getManifestPages();

// O manifesto e gerado a partir de apps/admin/src/app/(app)/(libraries). Num
// checkout limpo do template nao ha libraries instaladas, entao ele vem vazio e
// nao ha o que verificar: estas checagens passam a valer assim que a primeira
// library for criada por `hedhog dev create-library`.
describe.skipIf(manifestPages.length === 0)('manifesto gerado', () => {
  const pages = manifestPages;

  it('não está vazio', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('tem rotas únicas iniciadas por barra', () => {
    const routes = pages.map((page) => page.route);

    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.every((route) => route.startsWith('/'))).toBe(true);
  });

  it('não inclui diretórios privados', () => {
    expect(
      pages.some((page) => page.segments.some((segment) => segment.startsWith('_')))
    ).toBe(false);
  });

  it('lista as bibliotecas em ordem', () => {
    const libraries = listLibraries(pages);

    expect(libraries).toContain('core');
    expect([...libraries].sort()).toEqual(libraries);
  });

  it('nenhuma página se auto-referencia', () => {
    pages.forEach((page) => {
      expect(page.referencedBy).not.toContain(page.file);
      page.referencedBy.forEach((ref) => {
        expect(ref.startsWith(`${page.directory}/`)).toBe(false);
      });
    });
  });

  it('referencedBy e hasChildren estão presentes em todas as páginas', () => {
    pages.forEach((page) => {
      expect(Array.isArray(page.referencedBy)).toBe(true);
      expect(typeof page.hasChildren).toBe('boolean');
    });
  });

  it('hasChildren reflete a existência de subrotas', () => {
    const withChild = pages.find((page) =>
      pages.some(
        (other) =>
          other !== page && other.directory.startsWith(`${page.directory}/`)
      )
    );
    const withoutChild = pages.find(
      (page) =>
        !pages.some(
          (other) =>
            other !== page && other.directory.startsWith(`${page.directory}/`)
        )
    );

    expect(withChild?.hasChildren).toBe(true);
    expect(withoutChild?.hasChildren).toBe(false);
  });

  it('resolve referência dinâmica sem casar o prefixo', () => {
    // /lms/courses/:id é navegado no código; /lms (prefixo) não deve herdar
    // essas referências.
    const courses = pages.find((page) => page.route === '/lms/courses/:id');
    const lms = pages.find((page) => page.route === '/lms');

    if (courses) {
      expect(courses.referencedBy.length).toBeGreaterThan(0);
    }

    if (lms && courses) {
      // Um arquivo que só cita /lms/courses/... não deve constar em /lms.
      const onlyCoursesRef = courses.referencedBy.find(
        (ref) => !lms.referencedBy.includes(ref)
      );
      expect(onlyCoursesRef).toBeDefined();
    }
  });
});

function entry(overrides: Partial<PageManifestEntry> = {}): PageManifestEntry {
  return {
    route: '/crm/accounts',
    library: 'crm',
    segments: ['crm', 'accounts'],
    file: 'apps/admin/src/app/(app)/(libraries)/crm/accounts/page.tsx',
    directory: 'apps/admin/src/app/(app)/(libraries)/crm/accounts',
    components: [],
    loc: 10,
    i18nNamespaces: [],
    endpoints: [],
    features: features(),
    referencedBy: [],
    hasChildren: false,
    ...overrides,
  };
}

describe('mirrorPathForPage', () => {
  it('deriva o caminho do espelho a partir dos segmentos após a biblioteca', () => {
    expect(mirrorPathForPage(entry())).toBe(
      'libraries/crm/hedhog/frontend/app/accounts/page.tsx.ejs'
    );
  });

  it('lida com página raiz da biblioteca', () => {
    expect(
      mirrorPathForPage(entry({ route: '/crm', segments: ['crm'] }))
    ).toBe('libraries/crm/hedhog/frontend/app/page.tsx.ejs');
  });
});

describe('isLikelyResidue', () => {
  it('é resíduo quando estática, sem menu e sem referência', () => {
    expect(isLikelyResidue(entry(), false)).toBe(true);
  });

  it('não é resíduo quando tem menu', () => {
    expect(isLikelyResidue(entry(), true)).toBe(false);
  });

  it('não é resíduo quando é referenciada', () => {
    expect(isLikelyResidue(entry({ referencedBy: ['x.tsx'] }), false)).toBe(false);
  });

  it('não é resíduo quando a rota é dinâmica', () => {
    expect(
      isLikelyResidue(entry({ route: '/crm/accounts/:id' }), false)
    ).toBe(false);
  });
});

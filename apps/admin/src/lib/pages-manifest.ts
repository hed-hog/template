import manifest from '@/generated/pages-manifest.json';

export type PageManifestEndpoint = {
  method: string;
  url: string;
};

export type PageManifestFeatures = {
  pageHeader: boolean;
  kpis: boolean;
  searchBar: boolean;
  pagination: boolean;
  viewModeToggle: boolean;
  formSheet: boolean;
  dataTable: boolean;
  widgets: boolean;
};

export type PageManifestEntry = {
  route: string;
  library: string;
  segments: string[];
  file: string;
  directory: string;
  components: string[];
  loc: number;
  i18nNamespaces: string[];
  endpoints: PageManifestEndpoint[];
  features: PageManifestFeatures;
  /** Arquivos (fora do diretório da própria página) que navegam para esta rota. */
  referencedBy: string[];
  /** Existe outra página aninhada sob este diretório (não pode apagar o diretório inteiro). */
  hasChildren: boolean;
};

export type PageTemplateKind =
  | 'list-kpi'
  | 'list-simple'
  | 'detail-form'
  | 'dashboard'
  | 'custom';

const pages = (manifest as { pages: PageManifestEntry[] }).pages;

export function getManifestPages(): PageManifestEntry[] {
  return pages;
}

/**
 * Normaliza a URL para comparar página x menu x rota da API: minúsculas, sem
 * barra final e com os parâmetros dinâmicos reduzidos a `:param`.
 */
export function normalizeRoute(route: string): string {
  const trimmed = route.trim().toLowerCase().replace(/\/+$/, '');
  const normalized = trimmed.replace(/:[^/]+/g, ':param');

  return normalized === '' ? '/' : normalized;
}

/** Classifica a página em um dos templates conhecidos a partir das features detectadas. */
export function detectTemplate(features: PageManifestFeatures): PageTemplateKind {
  const isList = features.searchBar && features.pagination;

  if (isList) {
    return features.kpis ? 'list-kpi' : 'list-simple';
  }

  if (features.widgets || (features.kpis && !features.searchBar)) {
    return 'dashboard';
  }

  if (features.formSheet || features.pageHeader) {
    return 'detail-form';
  }

  return 'custom';
}

export function listLibraries(entries: PageManifestEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.library))]
    .filter(Boolean)
    .sort();
}

/**
 * Caminho do espelho `.ejs` da página na biblioteca (usado em novas instalações).
 * Os segmentos após o nome da biblioteca viram o subcaminho dentro de
 * `hedhog/frontend/app`. Ex.: `/crm/accounts` ->
 * `libraries/crm/hedhog/frontend/app/accounts/page.tsx.ejs`.
 */
export function mirrorPathForPage(entry: PageManifestEntry): string {
  const relative = entry.segments.slice(1).join('/');
  const suffix = relative ? `${relative}/` : '';

  return `libraries/${entry.library}/hedhog/frontend/app/${suffix}page.tsx.ejs`;
}

/**
 * Uma página é "possível resíduo" quando é estática (sem parâmetro dinâmico),
 * não tem menu vinculado e nenhum arquivo do código navega para ela — o padrão
 * de páginas esquecidas após refatorações.
 */
export function isLikelyResidue(
  entry: PageManifestEntry,
  hasMenu: boolean
): boolean {
  return (
    !hasMenu &&
    !entry.route.includes(':') &&
    entry.referencedBy.length === 0
  );
}

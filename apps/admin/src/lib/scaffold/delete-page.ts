import {
  mirrorPathForPage,
  type PageManifestEntry,
} from '@/lib/pages-manifest';
import { removeNamespace } from './generators/i18n-merge';
import {
  generateMenuRemovalSql,
  menuRemovalFolderName,
} from './generators/menu-removal-sql';
import { removeMenuBlock } from './generators/menu-yaml-remove';
import type { ScaffoldFs } from './types';

export type DeletionCategory =
  | 'page'
  | 'mirror'
  | 'i18n'
  | 'menu'
  | 'migration';

export type DeletionAction = 'delete' | 'rewrite' | 'create';

export type DeletionFile = {
  /** Caminho relativo à raiz do monorepo, com separadores `/`. */
  path: string;
  action: DeletionAction;
  category: DeletionCategory;
  /** Conteúdo final (apenas para `rewrite`/`create`). */
  contents?: string;
  /** Trecho mostrado no preview. */
  preview: string;
};

export type DeletionRequest = {
  route: string;
  /** Slug do menu vinculado; presente só quando a página tem menu sem filhos. */
  menuSlug?: string | null;
  /** Rótulo pt do menu, para o comentário da migration. */
  menuLabelPt?: string | null;
};

export class DeletePageError extends Error {}

function componentsDir(directory: string): string {
  return `${directory}/_components`;
}

/**
 * Namespaces i18n exclusivos desta página. Três guardas, todas necessárias:
 * - começam com `<lib>.` (namespace da própria biblioteca);
 * - terminam em `Page` (convenção de namespace específico de página — nunca um
 *   namespace de menu como `CrmMenu` ou compartilhado como `components`);
 * - nenhuma outra página do manifesto os declara.
 * Remover um namespace que não passe nas três quebraria outras telas.
 */
function exclusiveNamespaces(
  page: PageManifestEntry,
  pages: PageManifestEntry[]
): string[] {
  const prefix = `${page.library}.`;

  return page.i18nNamespaces.filter((namespace) => {
    if (!namespace.startsWith(prefix) || !namespace.endsWith('Page')) {
      return false;
    }

    return !pages.some(
      (other) =>
        other.route !== page.route &&
        other.i18nNamespaces.includes(namespace)
    );
  });
}

/**
 * Monta a lista de operações para excluir uma página do disco. É pura: recebe o
 * manifesto e um `fs` de leitura, devolve o que fazer. Quem escreve é o route
 * handler, que valida cada caminho contra a allowlist antes de tocar no disco.
 */
export function buildDeletionPlan(
  request: DeletionRequest,
  pages: PageManifestEntry[],
  fs: ScaffoldFs,
  timestamp: string
): DeletionFile[] {
  const page = pages.find((entry) => entry.route === request.route);

  if (!page) {
    throw new DeletePageError(`Página não encontrada: ${request.route}`);
  }

  const files: DeletionFile[] = [];

  // 1. Diretório da página. Com subrotas, remove só page.tsx e _components para
  //    não levar junto as páginas filhas.
  if (page.hasChildren) {
    files.push({
      path: page.file,
      action: 'delete',
      category: 'page',
      preview: page.file,
    });

    if (fs.exists(componentsDir(page.directory))) {
      files.push({
        path: componentsDir(page.directory),
        action: 'delete',
        category: 'page',
        preview: componentsDir(page.directory),
      });
    }
  } else {
    files.push({
      path: page.directory,
      action: 'delete',
      category: 'page',
      preview: page.directory,
    });
  }

  // 2. Espelho .ejs na biblioteca (mesma regra de subrotas).
  const mirror = mirrorPathForPage(page);
  const mirrorDir = mirror.replace(/\/page\.tsx\.ejs$/, '');

  if (page.hasChildren) {
    if (fs.exists(mirror)) {
      files.push({ path: mirror, action: 'delete', category: 'mirror', preview: mirror });
    }
    if (fs.exists(componentsDir(mirrorDir))) {
      files.push({
        path: componentsDir(mirrorDir),
        action: 'delete',
        category: 'mirror',
        preview: componentsDir(mirrorDir),
      });
    }
  } else if (fs.exists(mirrorDir)) {
    files.push({
      path: mirrorDir,
      action: 'delete',
      category: 'mirror',
      preview: mirrorDir,
    });
  } else if (fs.exists(mirror)) {
    files.push({ path: mirror, action: 'delete', category: 'mirror', preview: mirror });
  }

  // 3. Namespaces i18n exclusivos desta página.
  for (const namespace of exclusiveNamespaces(page, pages)) {
    const localKey = namespace.slice(page.library.length + 1);

    for (const locale of ['en', 'pt'] as const) {
      const messagesPath = `apps/admin/messages/${page.library}/${locale}.json`;
      const current = fs.read(messagesPath);
      const { contents, removed } = removeNamespace(current, localKey);

      if (removed) {
        files.push({
          path: messagesPath,
          action: 'rewrite',
          category: 'i18n',
          contents,
          preview: `- "${localKey}": { ... }`,
        });
      }
    }
  }

  // 4. Bloco de menu no YAML + migration de remoção (só quando há menu sem filhos).
  if (request.menuSlug) {
    const menuYamlPath = `libraries/${page.library}/hedhog/data/menu.yaml`;
    const currentYaml = fs.read(menuYamlPath);

    if (currentYaml) {
      const { contents, removed } = removeMenuBlock(currentYaml, request.menuSlug);

      if (removed) {
        files.push({
          path: menuYamlPath,
          action: 'rewrite',
          category: 'menu',
          contents,
          preview: `- slug: ${request.menuSlug} (removido)`,
        });
      }
    }

    const migrationPath = `apps/api/prisma/migrations/${menuRemovalFolderName(
      page.library,
      request.menuSlug,
      timestamp
    )}/migration.sql`;
    const migrationSql = generateMenuRemovalSql(
      request.menuSlug,
      request.menuLabelPt ?? request.menuSlug
    );

    files.push({
      path: migrationPath,
      action: 'create',
      category: 'migration',
      contents: migrationSql,
      preview: migrationSql,
    });
  }

  return files;
}

/** Passos manuais após a exclusão (nenhum é executado pelo route handler). */
export function buildDeletionFollowUps(
  page: Pick<PageManifestEntry, 'library'>,
  hasMenuMigration: boolean
): string[] {
  const steps: string[] = [];

  if (hasMenuMigration) {
    steps.push('cd apps/api && pnpm prisma:deploy');
  }

  steps.push(`hedhog dev assets-to-library ${page.library}`);

  return steps;
}

// Varre as páginas do admin e gera `src/generated/pages-manifest.json`, consumido
// pela tela `/core/pages`.
//
// O manifesto é gerado em build-time (predev/prebuild) e commitado no repositório:
// o bundle de produção não carrega `src/app/**` do disco, e typecheck/lint/test
// rodam sem passar pelo prebuild. A saída é determinística (sem timestamp e com
// ordenação estável) para que o diff só apareça quando uma página realmente muda.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(scriptDir, '..');
const srcRoot = path.join(adminRoot, 'src');
const pagesRoot = path.join(adminRoot, 'src', 'app', '(app)', '(libraries)');
const generatedRoot = path.join(adminRoot, 'src', 'generated');
const outputFile = path.join(
  adminRoot,
  'src',
  'generated',
  'pages-manifest.json'
);

const PRIVATE_DIR_PREFIX = '_';
const ROUTE_GROUP_PATTERN = /^\(.*\)$/;
const DYNAMIC_SEGMENT_PATTERN = /^\[{1,2}\.{0,3}(.+?)\]{1,2}$/;

/**
 * Componentes/hooks do padrão de listagem, usados para inferir o template da
 * página. Cada feature aceita mais de um marcador porque o repositório tem duas
 * gerações de código (ToggleGroup manual e o ViewModeToggle compartilhado).
 */
const FEATURE_MARKERS = {
  pageHeader: ['PageHeader'],
  kpis: ['KpiCardsGrid', 'KpiCard'],
  searchBar: ['SearchBar'],
  pagination: ['PaginationFooter'],
  viewModeToggle: ['ViewModeToggle', 'ToggleGroup'],
  formSheet: ['ResizableSheetContent'],
  dataTable: ['useReactTable'],
  widgets: ['useWidgetData'],
};

function walkDirectories(dir, visit) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === 'node_modules') {
      continue;
    }

    const childDir = path.join(dir, entry.name);
    visit(childDir);
    walkDirectories(childDir, visit);
  }
}

function collectFiles(dir, extensions) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

/**
 * Converte o caminho do diretório em rota do Next: grupos `(app)`/`(libraries)`
 * somem da URL e segmentos dinâmicos `[id]`/`[...slug]` viram `:id`/`:slug`.
 */
function toRoute(relativeDir) {
  const segments = toPosix(relativeDir)
    .split('/')
    .filter(Boolean)
    .filter((segment) => !ROUTE_GROUP_PATTERN.test(segment))
    .map((segment) => {
      const dynamic = segment.match(DYNAMIC_SEGMENT_PATTERN);
      return dynamic ? `:${dynamic[1]}` : segment;
    });

  return `/${segments.join('/')}`;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function extractNamespaces(source) {
  const namespaces = new Set();
  const pattern = /useTranslations\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    namespaces.add(match[1]);
  }

  return [...namespaces].sort();
}

/**
 * Interpolações viram parâmetros nomeados quando dá para inferir o nome
 * (`${accountId}` -> `:accountId`) e `:param` caso contrário.
 */
function normalizeUrl(rawUrl) {
  const withoutQuery = rawUrl.split('?')[0];

  return withoutQuery.replace(/\$\{([^}]*)\}/g, (_full, expression) => {
    const identifier = String(expression).match(/([A-Za-z_$][\w$]*)\s*$/);
    return identifier ? `:${identifier[1]}` : ':param';
  });
}

/**
 * Heurística: procura `url: '...'` e o `method:` mais próximo no mesmo objeto de
 * request. Não é análise de AST — a UI apresenta o resultado como inferido.
 */
function extractEndpoints(source) {
  const endpoints = new Map();
  const pattern = /url:\s*(['"`])(\/[^'"`]*)\1/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const url = normalizeUrl(match[2]);

    if (!url || url === '/') {
      continue;
    }

    const lookahead = source.slice(match.index, match.index + 240);
    const methodMatch = lookahead.match(/method:\s*['"`]([A-Za-z]+)['"`]/);
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
    const key = `${method} ${url}`;

    if (!endpoints.has(key)) {
      endpoints.set(key, { method, url });
    }
  }

  return [...endpoints.values()].sort((left, right) =>
    `${left.url} ${left.method}`.localeCompare(`${right.url} ${right.method}`)
  );
}

const MODULE_EXTENSIONS = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

/**
 * Resolve os imports relativos do `page.tsx` para arquivos reais dentro de
 * `(libraries)`. Profundidade 1: basta para os wrappers que só reexportam um
 * componente compartilhado, sem percorrer a árvore inteira de dependências.
 */
function resolveLocalImports(pageFile, source) {
  const dir = path.dirname(pageFile);
  const resolved = [];
  const pattern = /from\s+'(\.{1,2}\/[^']+)'/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const candidateBase = path.resolve(dir, match[1]);

    if (!candidateBase.startsWith(pagesRoot)) {
      continue;
    }

    for (const extension of MODULE_EXTENSIONS) {
      const candidate = `${candidateBase}${extension}`;

      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        resolved.push(candidate);
        break;
      }
    }
  }

  return resolved;
}

function extractFeatures(source) {
  return Object.fromEntries(
    Object.entries(FEATURE_MARKERS).map(([feature, markers]) => [
      feature,
      markers.some((marker) => source.includes(marker)),
    ])
  );
}

/** Normaliza uma rota (de página ou literal de código) para comparação. */
function normalizeRoute(route) {
  const trimmed = route.trim().toLowerCase().replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Extrai literais que parecem rota do código: `'/x'`, `"/x"` e template
 * literals `` `/x/${id}` ``, com as interpolações reduzidas a `:param`.
 * Ignora extensões de arquivo (`/foo.png`) e caminhos de import.
 */
function extractRouteLiterals(source) {
  const literals = new Set();

  const quoted = /(['"])(\/[A-Za-z0-9_\-/:]*)\1/g;
  let match;

  while ((match = quoted.exec(source)) !== null) {
    literals.add(normalizeRoute(match[2]));
  }

  const template = /`(\/[^`]*)`/g;

  while ((match = template.exec(source)) !== null) {
    const raw = match[1];

    if (!/^\/[A-Za-z0-9_\-/${}.:]*$/.test(raw)) {
      continue;
    }

    const normalized = raw.replace(/\$\{[^}]*\}/g, ':param');
    literals.add(normalizeRoute(normalized));
  }

  return literals;
}

/**
 * Casa uma rota de página contra um literal do código por segmento: mesmo
 * número de segmentos e cada par igual ou com um lado dinâmico (`:x`). Isso
 * faz `/lms/courses/:id` casar com `/lms/courses/123` e com `/lms/courses/:param`,
 * mas nunca com o prefixo `/lms` — senão todo índice de biblioteca pareceria usado.
 */
function routeMatchesLiteral(pageRoute, literal) {
  const pageSegments = pageRoute.split('/');
  const literalSegments = literal.split('/');

  if (pageSegments.length !== literalSegments.length) {
    return false;
  }

  return pageSegments.every((segment, index) => {
    const other = literalSegments[index];
    return segment === other || segment.startsWith(':') || other.startsWith(':');
  });
}

/** Indexa todo o código do admin (fora de testes e do manifesto gerado). */
function indexSourceReferences() {
  const index = [];

  for (const file of collectFiles(srcRoot, ['.ts', '.tsx', '.mjs'])) {
    if (
      file.endsWith('.test.ts') ||
      file.endsWith('.test.tsx') ||
      file.startsWith(generatedRoot)
    ) {
      continue;
    }

    const literals = extractRouteLiterals(readFileSafe(file));

    if (literals.size > 0) {
      index.push({ file, literals });
    }
  }

  return index;
}

function buildManifest() {
  if (!fs.existsSync(pagesRoot)) {
    return { pages: [] };
  }

  const pages = [];

  const visitDirectory = (dir) => {
    const pageFile = path.join(dir, 'page.tsx');

    if (!fs.existsSync(pageFile)) {
      return;
    }

    const relativeDir = path.relative(pagesRoot, dir);
    const segments = toPosix(relativeDir).split('/').filter(Boolean);

    // Nada dentro de `_components`/`_lib` é uma página roteável.
    if (segments.some((segment) => segment.startsWith(PRIVATE_DIR_PREFIX))) {
      return;
    }

    const pageSource = readFileSafe(pageFile);

    const componentFiles = [
      ...collectFiles(path.join(dir, '_components'), ['.tsx', '.ts']),
      // Muitas páginas são wrappers finos sobre um componente em `_components`
      // compartilhado da biblioteca; sem seguir o import, elas apareceriam sem
      // nenhuma feature, endpoint ou namespace.
      ...resolveLocalImports(pageFile, pageSource),
    ]
      .filter(
        (file) => !file.endsWith('.test.tsx') && !file.endsWith('.test.ts')
      )
      .filter((file, index, all) => all.indexOf(file) === index);

    const componentSources = componentFiles.map(readFileSafe);
    const combinedSource = [pageSource, ...componentSources].join('\n');

    const relativeToRepo = (filePath) =>
      toPosix(path.relative(path.resolve(adminRoot, '..', '..'), filePath));

    pages.push({
      route: toRoute(relativeDir),
      library: segments[0] ?? '',
      segments,
      file: relativeToRepo(pageFile),
      directory: relativeToRepo(dir),
      components: componentFiles.map(relativeToRepo),
      loc: pageSource.split('\n').length,
      i18nNamespaces: extractNamespaces(combinedSource),
      endpoints: extractEndpoints(combinedSource),
      features: extractFeatures(combinedSource),
    });
  };

  visitDirectory(pagesRoot);
  walkDirectories(pagesRoot, visitDirectory);

  const referenceIndex = indexSourceReferences();
  const repoRoot = path.resolve(adminRoot, '..', '..');
  const relativeToRepo = (filePath) =>
    toPosix(path.relative(repoRoot, filePath));

  pages.forEach((page) => {
    const ownDirPrefix = `${page.directory}/`;

    // Arquivos que apontam para a rota, ignorando o próprio diretório da página
    // (auto-referência de um wrapper para si mesmo não conta como uso externo).
    page.referencedBy = referenceIndex
      .filter((entry) => {
        const relative = relativeToRepo(entry.file);

        if (relative === page.file || relative.startsWith(ownDirPrefix)) {
          return false;
        }

        return [...entry.literals].some((literal) =>
          routeMatchesLiteral(page.route, literal)
        );
      })
      .map((entry) => relativeToRepo(entry.file))
      .sort();

    page.hasChildren = pages.some(
      (other) =>
        other !== page && other.directory.startsWith(`${page.directory}/`)
    );
  });

  pages.sort((left, right) => left.route.localeCompare(right.route));

  return { pages };
}

function main() {
  const manifest = buildManifest();

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  console.log(
    `[pages-manifest] ${manifest.pages.length} páginas -> ${toPosix(
      path.relative(adminRoot, outputFile)
    )}`
  );
}

main();

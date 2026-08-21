#!/usr/bin/env node
/**
 * Extrai de `@iconify-json/*` apenas os ícones que a aplicação realmente usa e
 * escreve cada subconjunto como um módulo TypeScript versionado.
 *
 * Por que existe: importar `{ icons } from '@iconify-json/logos'` num componente
 * client puxa o dataset inteiro para o bundle — 7,1 MB (2.091 logos) para
 * desenhar quatro botões de OAuth. Era 79% do JavaScript da tela de login do
 * `class`.
 *
 * A saída é commitada, e não gerada no `prebuild`, porque o Dockerfile do
 * `class` roda `pnpm install --filter class...`, que não instala as
 * devDependencies da raiz — um `prebuild` que dependesse de `@iconify-json/*`
 * quebraria o build da imagem.
 *
 * Uso:
 *   node scripts/generate-icon-subset.mjs           # regrava os módulos
 *   node scripts/generate-icon-subset.mjs --check   # falha se algo divergir
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');

/**
 * Manifesto dos subconjuntos. É a fonte única da verdade: para usar um logo
 * novo, acrescente o slug aqui e rode `pnpm generate:icons`.
 *
 * Os slugs precisam bater com os mapas do componente correspondente. A trava é
 * de tipo: cada módulo exporta `LogoSlug`/`FlagSlug` a partir das próprias
 * chaves, e os mapas são declarados como `Record<string, LogoSlug>` — citar um
 * slug que não foi gerado vira erro de compilação, não ícone faltando em
 * produção.
 */
const TARGETS = [
  {
    out: 'apps/class/lib/generated/oauth-logos.ts',
    collection: 'logos',
    // apps/class/components/oauth-provider-logo.tsx → providerLogoSlugs
    slugs: ['facebook', 'google-icon', 'linkedin-icon', 'microsoft-icon'],
  },
  {
    out: 'apps/partners/lib/generated/oauth-logos.ts',
    collection: 'logos',
    // apps/partners/components/oauth-provider-logo.tsx → providerLogoSlugs
    slugs: ['facebook', 'google-icon', 'linkedin-icon', 'microsoft-icon'],
  },
  {
    out: 'apps/admin/src/generated/integration-logos.ts',
    collection: 'logos',
    // apps/admin/src/components/ui/integration-logo.tsx → providerLogoIcons
    slugs: [
      'aws-s3',
      'aws-ses',
      'claude-icon',
      'cloudflare-icon',
      'deepseek-icon',
      'digital-ocean-icon',
      'facebook',
      'google-cloud',
      'google-gmail',
      'google-icon',
      'google-play-icon',
      'kubernetes',
      'linkedin-icon',
      'microsoft-azure',
      'microsoft-icon',
      'recaptcha',
      'whatsapp-icon',
    ],
  },
  {
    out: 'apps/admin/src/generated/browser-os-logos.ts',
    collection: 'logos',
    // apps/admin/src/components/browser-os-icon.tsx → BROWSER_LOGO + OS_LOGO
    slugs: BROWSER_OS_SLUGS(),
  },
  {
    out: 'apps/training/lib/generated/browser-os-logos.ts',
    collection: 'logos',
    // apps/training/components/browser-os-icon.tsx → BROWSER_LOGO + OS_LOGO
    slugs: BROWSER_OS_SLUGS(),
  },
  {
    out: 'apps/admin/src/generated/country-flags.ts',
    collection: 'flag',
    // Código ISO vem do banco, então não há lista literal: leva-se todas as
    // variantes 4×3 (as 1×1 nunca são usadas). Este módulo é carregado por
    // `import()` dinâmico, fora do caminho crítico.
    filter: (key) => key.endsWith('-4x3'),
  },
  {
    out: 'apps/training/lib/generated/country-flags.ts',
    collection: 'flag',
    filter: (key) => key.endsWith('-4x3'),
  },
];

/** Slugs de navegador e sistema operacional, compartilhados por admin e training. */
function BROWSER_OS_SLUGS() {
  return [
    // BROWSER_LOGO
    'brave',
    'chrome',
    'duckduckgo',
    'firefox',
    'internetexplorer',
    'microsoft-edge',
    'opera',
    'safari',
    'samsung',
    'tor',
    'vivaldi',
    'yandex-ru',
    // OS_LOGO
    'android-icon',
    'apple',
    'archlinux',
    'debian',
    'fedora',
    'linux-tux',
    'microsoft-windows-icon',
    'redhat',
    'ubuntu',
  ];
}

const COLLECTIONS = {
  logos: { pkg: '@iconify-json/logos', exportName: 'logoIcons', typeName: 'LogoSlug' },
  flag: { pkg: '@iconify-json/flag', exportName: 'flagIcons', typeName: 'FlagSlug' },
};

const cache = new Map();

function loadCollection(name) {
  if (cache.has(name)) return cache.get(name);
  const { pkg } = COLLECTIONS[name];
  const data = JSON.parse(readFileSync(require.resolve(`${pkg}/icons.json`), 'utf8'));
  const { version } = JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`), 'utf8'));
  const loaded = { data, version, pkg };
  cache.set(name, loaded);
  return loaded;
}

/**
 * Aspas simples para casar com o estilo do repositório: corpos de SVG são
 * cheios de `"` (`<path d="…">`) e ficam sem escape nenhum assim.
 */
function quote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function render(target) {
  const { data, version, pkg } = loadCollection(target.collection);
  const { exportName, typeName } = COLLECTIONS[target.collection];

  const keys = target.slugs
    ? [...target.slugs].sort()
    : Object.keys(data.icons).filter(target.filter).sort();

  const missing = keys.filter((key) => !data.icons[key]);
  if (missing.length > 0) {
    throw new Error(
      `${target.out}: slug(s) inexistente(s) em ${pkg}@${version}: ${missing.join(', ')}`
    );
  }

  // `width`/`height` são resolvidos aqui contra os defaults do conjunto, para
  // que o componente não precise carregar o fallback `?? set.width ?? 256`.
  const entries = keys.map((key) => {
    const icon = data.icons[key];
    const width = icon.width ?? data.width ?? 256;
    const height = icon.height ?? data.height ?? 256;
    return `  ${quote(key)}: { body: ${quote(icon.body)}, width: ${width}, height: ${height} },`;
  });

  const header = [
    `// GERADO por scripts/generate-icon-subset.mjs — NÃO EDITE À MÃO.`,
    `// Fonte: ${pkg}@${version} · ${keys.length} de ${Object.keys(data.icons).length} ícones.`,
    `// Para incluir outro ícone, edite TARGETS no gerador e rode \`pnpm generate:icons\`.`,
    ``,
    `export type IconifyIconData = { body: string; width: number; height: number }`,
    ``,
  ];

  // Subconjunto por lista literal: o tipo das chaves vira a trava de compilação
  // que impede citar um slug que não foi gerado.
  if (target.slugs) {
    return [
      ...header,
      `export const ${exportName} = {`,
      ...entries,
      `} satisfies Record<string, IconifyIconData>`,
      ``,
      `export type ${typeName} = keyof typeof ${exportName}`,
      ``,
    ].join('\n');
  }

  // Subconjunto dinâmico: a chave é montada em runtime, então o índice precisa
  // aceitar `string` e admitir ausência.
  return [
    ...header,
    `export const ${exportName}: Record<string, IconifyIconData | undefined> = {`,
    ...entries,
    `}`,
    ``,
  ].join('\n');
}

function main() {
  let diverged = 0;

  for (const target of TARGETS) {
    const path = join(ROOT, target.out);
    const contents = render(target);

    if (CHECK) {
      const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
      if (current !== contents) {
        console.error(
          `divergente: ${target.out} ${current === null ? '(não existe)' : '(conteúdo difere)'}`
        );
        diverged += 1;
      }
      continue;
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, 'utf8');
    console.log(`${target.out}: ${(Buffer.byteLength(contents) / 1024).toFixed(1)}KB`);
  }

  if (CHECK) {
    if (diverged > 0) {
      console.error(
        `\n${diverged} arquivo(s) fora de sincronia. Rode \`pnpm generate:icons\` e commite o resultado.`
      );
      process.exit(1);
    }
    console.log(`${TARGETS.length} subconjunto(s) em sincronia.`);
  }
}

main();

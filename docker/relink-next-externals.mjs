#!/usr/bin/env node
// Reaponta os symlinks que o Turbopack cria em `.next/node_modules` para o
// `node_modules` que vai existir na imagem final.
//
// O Turbopack materializa cada pacote que externaliza como um symlink
// `.next/node_modules/<pacote>-<hash>` -> `../../../../node_modules/.pnpm/<dir>/node_modules/<pacote>`,
// relativo a `apps/<app>/.next`. Os Dockerfiles fazem
// `COPY --from=build /usr/src/app/apps/<app>/.next /usr/src/app/.next`, que sobe
// o `.next` dois níveis, então esses `../` passariam a apontar para fora da
// imagem — o app sobe, o pod fica 1/1 Running e toda requisição vira 500.
//
// Reancorar o caminho em `/usr/src/app` não basta: o `node_modules` da imagem
// não é o do build, e sim o de um segundo install (`pnpm --prod deploy`), cujo
// virtual store usa outros nomes de diretório. O mesmo pacote que no build está
// em `.pnpm/require-in-the-middle@8.0.1` aparece no deploy como
// `.pnpm/require-in-the-middle@8.0.1_supports-color@8.1.1`, e nomes longos ainda
// viram hash truncado (`.pnpm/@radix-ui+react-accordion@1_b703e42374...`). Por
// isso a resolução aqui é por **pacote** (nome + versão do package.json), nunca
// pelo caminho literal que o Turbopack gravou.
//
// Uso, no build stage e depois do `pnpm deploy`:
//   node docker/relink-next-externals.mjs apps/<app>/.next /usr/src/deploy /usr/src/app
//
//   <nextDir>     diretório .next recém-buildado (onde estão os symlinks)
//   <deployRoot>  raiz do `pnpm deploy` (onde está o node_modules de produção)
//   <runtimeRoot> caminho para onde o <deployRoot> é copiado na imagem final

import fs from 'node:fs';
import path from 'node:path';

const [nextDir, deployRoot, runtimeRoot] = process.argv.slice(2);

if (!nextDir || !deployRoot || !runtimeRoot) {
  console.error(
    'uso: relink-next-externals.mjs <nextDir> <deployRoot> <runtimeRoot>',
  );
  process.exit(1);
}

const externalsDir = path.resolve(nextDir, 'node_modules');

if (!fs.existsSync(externalsDir)) {
  // Apps que buildam com webpack não geram .next/node_modules.
  console.log(`relink-next-externals: ${externalsDir} não existe, nada a fazer`);
  process.exit(0);
}

/** Lê o `version` de um package.json, ou null se o diretório não for um pacote. */
function readVersion(pkgDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
    ).version;
  } catch {
    return null;
  }
}

/**
 * Indexa os pacotes reais do node_modules do deploy como nome -> versão -> dir.
 *
 * Só entram diretórios de verdade: dentro do virtual store do pnpm, o pacote
 * dono da pasta é um diretório e as dependências dele são symlinks, então isso
 * registra exatamente a localização canônica de cada pacote. O node_modules da
 * raiz entra junto para cobrir um layout hoisted.
 */
function indexPackages(deployNodeModules) {
  const index = new Map();
  const store = path.join(deployNodeModules, '.pnpm');
  const roots = fs.existsSync(store)
    ? fs
        .readdirSync(store)
        .map((entry) => path.join(store, entry, 'node_modules'))
    : [];

  roots.push(deployNodeModules);

  const register = (name, dir) => {
    const version = readVersion(dir);
    if (!version) return;
    const byVersion = index.get(name) ?? new Map();
    if (!byVersion.has(version)) byVersion.set(version, dir);
    index.set(name, byVersion);
  };

  for (const root of roots) {
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.bin') continue;

      if (entry.name.startsWith('@')) {
        const scopeDir = path.join(root, entry.name);
        for (const scoped of fs.readdirSync(scopeDir, { withFileTypes: true })) {
          if (!scoped.isDirectory()) continue;
          register(`${entry.name}/${scoped.name}`, path.join(scopeDir, scoped.name));
        }
        continue;
      }

      register(entry.name, path.join(root, entry.name));
    }
  }

  return index;
}

/** Lista os symlinks de .next/node_modules, inclusive os de pacotes com escopo. */
function collectSymlinks(dir, depth = 0) {
  const links = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) links.push(full);
    else if (entry.isDirectory() && depth < 1) links.push(...collectSymlinks(full, depth + 1));
  }

  return links;
}

const index = indexPackages(path.resolve(deployRoot, 'node_modules'));
const links = collectSymlinks(externalsDir);
const errors = [];
let relinked = 0;

for (const link of links) {
  const rawTarget = fs.readlinkSync(link);
  let pkgDir;

  try {
    pkgDir = fs.realpathSync(link);
  } catch {
    errors.push(`${link} -> ${rawTarget} (alvo não existe no build stage)`);
    continue;
  }

  const manifestPath = path.join(pkgDir, 'package.json');
  let manifest;

  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    errors.push(`${link} -> ${pkgDir} (sem package.json legível)`);
    continue;
  }

  const { name, version } = manifest;
  const byVersion = index.get(name);
  let resolved = byVersion?.get(version);

  if (!resolved && byVersion?.size === 1) {
    // Versão diferente entre os dois installs: só acontece se o lockfile não
    // estiver fixando o pacote. Com um único candidato dá para seguir, mas o
    // build precisa registrar isso.
    const [only] = [...byVersion.entries()];
    console.warn(
      `relink-next-externals: ${name}@${version} não existe no deploy, usando ${name}@${only[0]}`,
    );
    resolved = only[1];
  }

  if (!resolved) {
    errors.push(
      `${name}@${version} (usado por ${path.relative(externalsDir, link)}) não está no node_modules de produção` +
        (byVersion
          ? `; versões disponíveis: ${[...byVersion.keys()].join(', ')}`
          : '; nenhuma versão encontrada — é dependência de desenvolvimento?'),
    );
    continue;
  }

  const runtimeTarget = path.join(
    runtimeRoot,
    path.relative(path.resolve(deployRoot), resolved),
  );

  fs.rmSync(link, { force: true });
  fs.symlinkSync(runtimeTarget, link);
  relinked += 1;

  console.log(
    `relink-next-externals: ${path.relative(externalsDir, link)} -> ${runtimeTarget}`,
  );
}

if (errors.length) {
  console.error(
    `relink-next-externals: ${errors.length} pacote(s) externalizado(s) sem destino na imagem:`,
  );
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `relink-next-externals: ${relinked} symlink(s) reapontados para ${runtimeRoot}`,
);
